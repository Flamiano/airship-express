"use client";

import { useEffect, useState, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface CustomCursorProps {
    containerRef?: RefObject<HTMLElement | null>;
}

const INTERACTIVE_SELECTOR =
    'a, button, [role="button"], input, select, textarea, label, [tabindex], .cursor-pointer, .cursor-hover, .card, .kpi, table tbody tr, .table-pro tbody tr, th[onclick], [data-interactive="true"], [data-sonner-toast], [data-button], [data-close-button], .offline-banner-container button, .offline-indicator, .offline-indicator button';

const MODAL_SELECTOR =
    '[role="dialog"], [aria-modal="true"], .fixed.inset-0.backdrop-blur-md, .fixed.inset-0.backdrop-blur-sm, .fixed.inset-0.backdrop-blur-lg, .fixed.inset-0[class*="z-"], [class*="modal"], [id*="modal"]';

export default function CustomCursor({ containerRef }: CustomCursorProps) {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const [hoveringInteractive, setHoveringInteractive] = useState(false);
    const isModalOpenRef = useRef(false);

    // direct 1:1 hardware motion coordinates for zero input latency
    const cursorX = useMotionValue(-100);
    const cursorY = useMotionValue(-100);

    // smooth subtle spring physics for the ambient glow trail dot only
    const trailX = useSpring(cursorX, { stiffness: 350, damping: 28, mass: 0.5 });
    const trailY = useSpring(cursorY, { stiffness: 350, damping: 28, mass: 0.5 });

    useEffect(() => {
        setMounted(true);
    }, []);

    // monitor for any open modals in the dom so cursor automatically locks to pointer
    useEffect(() => {
        if (!mounted) return;

        const checkModalState = () => {
            const hasModal = !!document.querySelector(
                '[role="dialog"], [aria-modal="true"], .fixed.inset-0.backdrop-blur-md, .fixed.inset-0.backdrop-blur-sm, .fixed.inset-0.backdrop-blur-lg, .fixed.inset-0[class*="z-"]'
            );
            isModalOpenRef.current = hasModal;
            if (hasModal) {
                setHoveringInteractive(true);
            }
        };

        checkModalState();

        const observer = new MutationObserver(checkModalState);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [mounted]);

    useEffect(() => {
        if (!mounted) return;

        const isInsideModal = (target: HTMLElement | null): boolean => {
            if (isModalOpenRef.current) return true;
            return !!target?.closest(MODAL_SELECTOR);
        };

        // ultra-lightweight move handler: purely updates coordinates with zero dom queries
        const handleMove = (e: MouseEvent) => {
            cursorX.set(e.clientX);
            cursorY.set(e.clientY);
            if (!visible) setVisible(true);
        };

        const handleEnter = (e: MouseEvent) => {
            cursorX.set(e.clientX);
            cursorY.set(e.clientY);
            setVisible(true);
        };

        const handleLeave = () => {
            setVisible(false);
            setHoveringInteractive(false);
        };

        // element hover state only updates when crossing element boundaries
        const handleOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (isInsideModal(target)) {
                setHoveringInteractive(true);
            } else {
                setHoveringInteractive(!!target?.closest(INTERACTIVE_SELECTOR));
            }
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
    }, [mounted, visible, cursorX, cursorY]);

    if (!mounted) return null;

    return createPortal(
        <>
            {/* ambient glow trail dot */}
            <motion.div
                aria-hidden
                className="hidden md:block pointer-events-none fixed left-0 top-0 custom-cursor"
                style={{
                    x: trailX,
                    y: trailY,
                    translateX: "-50%",
                    translateY: "-50%",
                    willChange: "transform",
                    zIndex: 2147483647,
                }}
            >
                <motion.span
                    animate={{
                        scale: visible ? (hoveringInteractive ? 4.5 : 1) : 0,
                        opacity: visible ? (hoveringInteractive ? 0.16 : 0.55) : 0,
                    }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="block h-2 w-2 rounded-full bg-accent"
                />
            </motion.div>

            {/* main cursor element with instant 0ms tracking and gpu acceleration */}
            <motion.div
                aria-hidden
                className="hidden md:block pointer-events-none fixed left-0 top-0 custom-cursor"
                style={{
                    x: cursorX,
                    y: cursorY,
                    willChange: "transform",
                    zIndex: 2147483647,
                }}
            >
                <div className="relative w-7 h-7">
                    {/* pointing hand cursor for interactive elements & open modals */}
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`drop-shadow-[0_4px_10px_rgba(229,22,126,0.4)] -translate-x-1.5 -translate-y-1 absolute top-0 left-0 transition-opacity duration-75 ${
                            visible && hoveringInteractive ? "opacity-100 scale-100" : "opacity-0 scale-90"
                        }`}
                        style={{ transitionProperty: "opacity, transform" }}
                    >
                        <path
                            d="M8 12V4.5C8 3.67 8.67 3 9.5 3S11 3.67 11 4.5V11M11 9V6.5C11 5.67 11.67 5 12.5 5S14 5.67 14 6.5V11M14 9.5C14 8.67 14.67 8 15.5 8S17 8.67 17 9.5V13M17 11.5C17 10.67 17.67 10 18.5 10S20 10.67 20 11.5V16C20 19.31 17.31 22 14 22H11C8.79 22 6.8 20.61 6.09 18.52L4.23 13.06C3.96 12.27 4.39 11.41 5.18 11.14C5.86 10.91 6.61 11.23 6.91 11.87L8 14.2V12z"
                            fill="white"
                            stroke="#E5167E"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>

                    {/* default stylish arrow cursor */}
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`drop-shadow-[0_4px_10px_rgba(229,22,126,0.35)] absolute top-0 left-0 transition-opacity duration-75 ${
                            visible && !hoveringInteractive ? "opacity-100 scale-100" : "opacity-0 scale-90"
                        }`}
                        style={{ transitionProperty: "opacity, transform" }}
                    >
                        <path
                            d="M4 3l7.07 16.97 2.51-7.39 7.39-2.51L4 3z"
                            fill="white"
                            stroke="#E5167E"
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </motion.div>
        </>,
        document.body
    );
}
