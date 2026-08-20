"use client";

import { useEffect, useState, type RefObject } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface CustomCursorProps {
    containerRef: RefObject<HTMLElement | null>;
}


const INTERACTIVE_SELECTOR =
    'a, button, [role="button"], input, select, textarea, .cursor-hover';

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
        const el = containerRef.current;
        if (!el) return;

        const handleMove = (e: MouseEvent) => {
            cursorX.set(e.clientX);
            cursorY.set(e.clientY);
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

        el.addEventListener("mousemove", handleMove);
        el.addEventListener("mouseenter", handleEnter);
        el.addEventListener("mouseleave", handleLeave);
        el.addEventListener("mouseover", handleOver);

        return () => {
            el.removeEventListener("mousemove", handleMove);
            el.removeEventListener("mouseenter", handleEnter);
            el.removeEventListener("mouseleave", handleLeave);
            el.removeEventListener("mouseover", handleOver);
        };
    }, [containerRef, cursorX, cursorY]);

    return (
        <>
            <motion.div
                aria-hidden
                className="pointer-events-none fixed left-0 top-0 z-[60] hidden lg:block"
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
                className="pointer-events-none fixed left-0 top-0 z-[60] hidden lg:block"
                style={{ x: arrowX, y: arrowY }}
            >
                <motion.svg
                    animate={{
                        scale: visible ? (hoveringInteractive ? 0.85 : 1) : 0,
                        opacity: visible ? 1 : 0,
                    }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    width="30"
                    height="30"
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
            </motion.div>
        </>
    );
}