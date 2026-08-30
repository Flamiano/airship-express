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
    const pinX = useSpring(cursorX, { stiffness: 140, damping: 28, mass: 1.3 });
    const pinY = useSpring(cursorY, { stiffness: 140, damping: 28, mass: 1.3 });
    const connectorX = useMotionValue(0);
    const connectorY = useMotionValue(0);
    const connectorRotate = useMotionValue(0);
    const connectorLength = useMotionValue(36);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const syncConnector = () => {
            const ax = arrowX.get();
            const ay = arrowY.get();
            const px = pinX.get();
            const py = pinY.get();
            const dx = ax - px;
            const dy = ay - py;
            const distance = Math.hypot(dx, dy) || 1;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            connectorX.set((ax + px) / 2);
            connectorY.set((ay + py) / 2);
            connectorRotate.set(angle);
            connectorLength.set(Math.min(120, Math.max(28, distance)));
        };

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

        const unsubArrowX = arrowX.on("change", syncConnector);
        const unsubArrowY = arrowY.on("change", syncConnector);
        const unsubPinX = pinX.on("change", syncConnector);
        const unsubPinY = pinY.on("change", syncConnector);

        el.addEventListener("mousemove", handleMove);
        el.addEventListener("mouseenter", handleEnter);
        el.addEventListener("mouseleave", handleLeave);
        el.addEventListener("mouseover", handleOver);
        syncConnector();

        return () => {
            unsubArrowX();
            unsubArrowY();
            unsubPinX();
            unsubPinY();
            el.removeEventListener("mousemove", handleMove);
            el.removeEventListener("mouseenter", handleEnter);
            el.removeEventListener("mouseleave", handleLeave);
            el.removeEventListener("mouseover", handleOver);
        };
    }, [containerRef, cursorX, cursorY, arrowX, arrowY, pinX, pinY, connectorX, connectorY, connectorRotate, connectorLength]);

    return (
        <div aria-hidden className="cursor-layer pointer-events-none fixed inset-0 z-[2147483647] hidden lg:block">
            <motion.div
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-30"
                style={{ x: trailX, y: trailY, translateX: "-50%", translateY: "-50%" }}
            >
                <motion.span
                    animate={{
                        scale: visible ? (hoveringInteractive ? 4.5 : 1) : 0,
                        opacity: visible ? (hoveringInteractive ? 0.16 : 0.55) : 0,
                    }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="block h-2 w-2 rounded-full bg-[#E5167E]"
                    style={{
                        filter: "blur(6px)",
                        transformOrigin: "center",
                    }}
                />
            </motion.div>

            <motion.div
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-30"
                style={{ x: pinX, y: pinY, translateX: "-50%", translateY: "-50%" }}
            >
                <motion.svg
                    animate={{
                        scale: visible ? (hoveringInteractive ? 0.75 : 1) : 0,
                        opacity: visible ? 0.85 : 0,
                    }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="drop-shadow-[0_8px_18px_rgba(229,22,126,0.35)]"
                    style={{ transformOrigin: "center" }}
                >
                    <path
                        d="M12 1.8C7.39 1.8 3.8 5.24 3.8 9.69c0 5.56 6.8 11.59 8.2 12.98 1.4-1.39 8.2-7.42 8.2-12.98C20.2 5.24 16.61 1.8 12 1.8Z"
                        fill="rgba(255,255,255,0.9)"
                        stroke="#E5167E"
                        strokeWidth="1.5"
                    />
                    <circle cx="12" cy="9.7" r="3.3" fill="#E5167E" />
                </motion.svg>
            </motion.div>

            <motion.div
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-20"
                style={{ x: connectorX, y: connectorY, rotate: connectorRotate, translateX: "-50%", translateY: "-50%" }}
            >
                <motion.svg
                    animate={{
                        scale: visible ? (hoveringInteractive ? 0.95 : 1) : 0,
                        opacity: visible ? 0.9 : 0,
                    }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    viewBox="0 0 120 28"
                    fill="none"
                    style={{ width: connectorLength, height: 28 }}
                >
                    <path
                        d="M12 14 L28 9 L42 18 L58 8 L72 18 L88 10 L104 14"
                        stroke="#E5167E"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="3 9"
                        opacity="0.75"
                    />
                    <circle cx="104" cy="14" r="4" fill="#E5167E" opacity="0.92" />
                    <circle cx="72" cy="18" r="2.2" fill="#E5167E" opacity="0.72" />
                    <circle cx="42" cy="18" r="2.2" fill="#E5167E" opacity="0.52" />
                </motion.svg>
            </motion.div>

            <motion.div
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-30"
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
        </div>
    );
}
