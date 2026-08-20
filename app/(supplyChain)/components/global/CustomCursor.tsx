"use client";

import { useEffect, useState, type RefObject } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface CustomCursorProps {
    containerRef: RefObject<HTMLElement | null>;
}

const INTERACTIVE_SELECTOR =
    'a, button, [role="button"], input, select, textarea, label, [tabindex], .cursor-pointer, .cursor-hover, .card, .kpi, table tbody tr, .table-pro tbody tr, th[onclick], th:has(button), th:has(input), td:has(button), td:has(input), td:has(a), [data-interactive="true"]';

export default function CustomCursor({ containerRef }: CustomCursorProps) {
    const [visible, setVisible] = useState(false);
    const [hoveringInteractive, setHoveringInteractive] = useState(false);
    const cursorX = useMotionValue(-100);
    const cursorY = useMotionValue(-100);

    const arrowX = useSpring(cursorX, { stiffness: 600, damping: 42, mass: 0.4 });
    const arrowY = useSpring(cursorY, { stiffness: 600, damping: 42, mass: 0.4 });
    const trailX = useSpring(cursorX, { stiffness: 220, damping: 26, mass: 0.6 });
    const trailY = useSpring(cursorY, { stiffness: 220, damping: 26, mass: 0.6 });

    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            cursorX.set(e.clientX);
            cursorY.set(e.clientY);
            if (!visible) setVisible(true);
        };
        const handleEnter = () => setVisible(true);
        const handleLeave = () => {
            setVisible(false);
            setHoveringInteractive(false);
        };
        const handleOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            setHoveringInteractive(!!target?.closest(INTERACTIVE_SELECTOR));
        };

        window.addEventListener("mousemove", handleMove, { passive: true });
        window.addEventListener("mouseenter", handleEnter);
        window.addEventListener("mouseleave", handleLeave);
        window.addEventListener("mouseover", handleOver, { passive: true });

        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseenter", handleEnter);
            window.removeEventListener("mouseleave", handleLeave);
            window.removeEventListener("mouseover", handleOver);
        };
    }, [cursorX, cursorY, visible]);

    return (
        <>
            <motion.div
                aria-hidden
                className="pointer-events-none fixed left-0 top-0 z-[999999]"
                style={{ x: trailX, y: trailY, translateX: "-50%", translateY: "-50%" }}
            >
                <motion.span
                    animate={{
                        scale: visible ? (hoveringInteractive ? 4.5 : 1) : 0,
                        opacity: visible ? (hoveringInteractive ? 0.16 : 0.55) : 0,
                    }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="block h-2 w-2 rounded-full bg-accent"
                />
            </motion.div>

            <motion.div
                aria-hidden
                className="pointer-events-none fixed left-0 top-0 z-[999999]"
                style={{ x: arrowX, y: arrowY }}
            >
                {hoveringInteractive ? (
                    /* Pointing hand cursor for interactive elements (links, buttons, clickable elements) */
                    <motion.svg
                        key="pointer-hand"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{
                            scale: visible ? 1 : 0,
                            opacity: visible ? 1 : 0,
                        }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="drop-shadow-[0_4px_10px_rgba(229,22,126,0.4)] -translate-x-1.5 -translate-y-1"
                    >
                        {/* Pointing hand icon */}
                        <path
                            d="M8 12V4.5C8 3.67 8.67 3 9.5 3S11 3.67 11 4.5V11M11 9V6.5C11 5.67 11.67 5 12.5 5S14 5.67 14 6.5V11M14 9.5C14 8.67 14.67 8 15.5 8S17 8.67 17 9.5V13M17 11.5C17 10.67 17.67 10 18.5 10S20 10.67 20 11.5V16C20 19.31 17.31 22 14 22H11C8.79 22 6.8 20.61 6.09 18.52L4.23 13.06C3.96 12.27 4.39 11.41 5.18 11.14C5.86 10.91 6.61 11.23 6.91 11.87L8 14.2V12z"
                            fill="white"
                            stroke="#E5167E"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </motion.svg>
                ) : (
                    /* Default stylish arrow cursor */
                    <motion.svg
                        key="default-arrow"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{
                            scale: visible ? 1 : 0,
                            opacity: visible ? 1 : 0,
                        }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="drop-shadow-[0_4px_10px_rgba(229,22,126,0.35)]"
                    >
                        <path
                            d="M4 3l7.07 16.97 2.51-7.39 7.39-2.51L4 3z"
                            fill="white"
                            stroke="#E5167E"
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                        />
                    </motion.svg>
                )}
            </motion.div>
        </>
    );
}
