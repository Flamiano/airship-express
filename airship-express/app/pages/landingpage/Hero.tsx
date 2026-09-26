"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
    ArrowRight,
    MapPin,
    MousePointer2,
    Package,
    Truck,
    MapPinned,
    CheckCircle2,
    Clock,
} from "lucide-react";

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    show: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
    }),
};

const deliverySteps = [
    { icon: Package, label: "Pickup" },
    { icon: Truck, label: "In Transit" },
    { icon: MapPinned, label: "Nearby" },
    { icon: CheckCircle2, label: "Delivered" },
];

const BLUR_THRESHOLD = 180;

// hydration-safe reduced-motion check
// server always renders as "false" (matchMedia doesn't exist there), so we
// hold the client at "false" too until after mount, then sync to the real value.
function useSafeReducedMotion() {
    const prefersReduced = useReducedMotion();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    return mounted ? !!prefersReduced : false;
}

// split text
function SplitWords({
    text,
    className = "",
    delay = 0,
    stagger = 0.05,
    ready,
    reduceMotion,
}: {
    text: string;
    className?: string;
    delay?: number;
    stagger?: number;
    ready: boolean;
    reduceMotion: boolean;
}) {
    const words = text.split(" ");

    return (
        <span className={className} aria-label={text}>
            {words.map((word, i) => (
                <span
                    key={i}
                    aria-hidden="true"
                    className="inline-block overflow-hidden pb-1 pr-[0.28em] align-bottom"
                >
                    <motion.span
                        className="inline-block will-change-[transform,opacity,filter]"
                        initial={{ y: "110%", opacity: 0, filter: reduceMotion ? "blur(0px)" : "blur(8px)" }}
                        animate={
                            ready
                                ? { y: "0%", opacity: 1, filter: "blur(0px)" }
                                : { y: "110%", opacity: 0, filter: reduceMotion ? "blur(0px)" : "blur(8px)" }
                        }
                        transition={{
                            duration: reduceMotion ? 0.01 : 0.6,
                            delay: reduceMotion ? 0 : delay + i * stagger,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                    >
                        {word}
                    </motion.span>
                </span>
            ))}
        </span>
    );
}

export default function Hero({ ready = true }: { ready?: boolean }) {
    const [scrolledPast, setScrolledPast] = useState(false);
    const reduceMotion = useSafeReducedMotion();

    useEffect(() => {
        const scrollEl = document.querySelector<HTMLElement>(".scroll-container");
        if (!scrollEl) return;

        const handleScroll = () => {
            setScrolledPast(scrollEl.scrollTop > BLUR_THRESHOLD);
        };

        handleScroll();
        scrollEl.addEventListener("scroll", handleScroll, { passive: true });
        return () => scrollEl.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <section
            className={`relative flex w-full min-h-[calc(100svh-4rem)] lg:min-h-[calc(100svh-6.25rem)] flex-col items-center justify-center overflow-hidden px-4 py-10 transition-[filter,opacity,background-color] duration-500 ease-out sm:px-6 sm:py-12 md:px-8 lg:px-12 lg:py-14 bg-paper dark:bg-ink ${scrolledPast ? "blur-md opacity-55" : "blur-0 opacity-100"
                }`}
        >
            <div className="pointer-events-none absolute -top-32 -left-32 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
            <div className="pointer-events-none absolute -top-20 -right-24 h-72 w-72 rounded-full blur-3xl transition-colors duration-500 bg-ink/5 dark:bg-paper/5" />

            {/* floating cards */}
            <motion.div
                initial={{ opacity: 0, y: 16, rotate: -3 }}
                animate={ready ? { opacity: 1, y: 0, rotate: -3 } : { opacity: 0, y: 16, rotate: -3 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="absolute left-4 top-16 z-10 hidden w-52 overflow-hidden rounded-2xl border shadow-xl sm:block md:left-10 lg:left-16 border-line bg-white dark:border-paper/10 dark:bg-ink"
            >
                <div className="flex items-center gap-1.5 border-b px-3 py-2 border-line dark:border-paper/10">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="h-2 w-2 rounded-full bg-yellow-400" />
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                </div>
                <div className="relative p-4">
                    <div className="h-2 w-20 rounded-full bg-line dark:bg-paper/15" />
                    <div className="mt-2 h-2 w-14 rounded-full bg-line/70 dark:bg-paper/10" />
                    <div className="mt-4 flex w-fit items-center gap-1.5 rounded-full bg-accent px-3 py-1.5">
                        <span className="font-rethink text-xs font-semibold text-paper">Picked Up</span>
                    </div>
                    <MousePointer2 className="absolute bottom-3 right-5 h-4 w-4 text-accent" />
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 16, rotate: 3 }}
                animate={ready ? { opacity: 1, y: 0, rotate: 3 } : { opacity: 0, y: 16, rotate: 3 }}
                transition={{ duration: 0.7, delay: 0.35 }}
                className="absolute bottom-12 right-4 z-10 hidden w-52 overflow-hidden rounded-2xl border shadow-xl md:right-10 lg:right-16 xl:block border-line bg-white dark:border-paper/10 dark:bg-ink"
            >
                <div className="flex items-center gap-1.5 border-b px-3 py-2 border-line dark:border-paper/10">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="h-2 w-2 rounded-full bg-yellow-400" />
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                </div>
                <div className="p-4">
                    <div className="flex items-center justify-between rounded-full bg-accent/10 px-3 py-1.5">
                        <span className="font-rethink text-xs font-semibold text-accent">Same-Day</span>
                        <span className="flex h-5 w-9 items-center rounded-full bg-accent p-0.5">
                            <span className="h-4 w-4 rounded-full bg-paper" />
                        </span>
                    </div>
                    <div className="mt-3 h-2 w-24 rounded-full bg-line dark:bg-paper/15" />
                    <div className="mt-2 h-2 w-16 rounded-full bg-line/70 dark:bg-paper/10" />
                </div>
            </motion.div>

            <div
                aria-hidden
                className="pointer-none absolute -bottom-10 left-8 hidden h-24 w-24 rounded-full border-[14px] border-accent/60 lg:block"
                style={{ clipPath: "inset(0 0 50% 0)" }}
            />
            <div aria-hidden className="pointer-events-none absolute bottom-24 right-0 hidden h-16 w-16 rounded-tl-full bg-accent/20 lg:block" />
            <div aria-hidden className="pointer-events-none absolute bottom-8 right-0 hidden h-16 w-16 rounded-bl-full bg-accent/40 lg:block" />

            <div className="relative z-20 flex w-full items-center justify-center">
                <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate={ready ? "show" : "hidden"}
                        custom={0}
                        className="mb-4 flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-center font-rethink text-[11px] font-medium sm:mb-5 sm:px-4 sm:text-xs md:text-sm border-line bg-white text-muted dark:border-paper/15 dark:bg-paper/5 dark:text-paper/70"
                    >
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                        </span>
                        For online sellers, businesses & individuals
                    </motion.div>

                    {/* heading */}
                    <div className="flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-2">
                        <h1 className="font-bricolage text-[1.9rem] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[38px] sm:leading-[1.1] sm:tracking-[-0.04em] md:text-[48px] md:leading-[1.12] lg:text-[54px] lg:leading-[1.05] text-ink dark:text-paper">
                            <SplitWords text="We Deliver Parcels" delay={0.15} stagger={0.05} ready={ready} reduceMotion={reduceMotion} />
                        </h1>

                        <motion.span
                            initial={{ opacity: 0, scale: 0.85, filter: reduceMotion ? "blur(0px)" : "blur(6px)" }}
                            animate={
                                ready
                                    ? { opacity: 1, scale: 1, filter: "blur(0px)" }
                                    : { opacity: 0, scale: 0.85, filter: reduceMotion ? "blur(0px)" : "blur(6px)" }
                            }
                            transition={{ duration: reduceMotion ? 0.01 : 0.5, delay: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-2.5 sm:h-10 sm:px-4 md:h-12 md:px-5 lg:h-14 lg:px-6"
                        >
                            <Clock className="h-3.5 w-3.5 text-paper sm:h-5 sm:w-5 md:h-6 md:w-6" />
                            <span className="font-bricolage text-xs font-extrabold text-paper sm:text-base md:text-xl lg:text-2xl">
                                Same-Day
                            </span>
                        </motion.span>

                        <h1 className="font-bricolage text-[1.9rem] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[38px] sm:leading-[1.1] sm:tracking-[-0.04em] md:text-[48px] md:leading-[1.12] lg:text-[54px] lg:leading-[1.05] text-ink dark:text-paper">
                            <SplitWords text="Every Time" delay={0.65} stagger={0.05} ready={ready} reduceMotion={reduceMotion} />
                        </h1>
                    </div>

                    <motion.p
                        initial={{ opacity: 0, y: 12, filter: reduceMotion ? "blur(0px)" : "blur(6px)" }}
                        animate={
                            ready
                                ? { opacity: 1, y: 0, filter: "blur(0px)" }
                                : { opacity: 0, y: 12, filter: reduceMotion ? "blur(0px)" : "blur(6px)" }
                        }
                        transition={{ duration: reduceMotion ? 0.01 : 0.6, delay: reduceMotion ? 0 : 1, ease: [0.22, 1, 0.36, 1] }}
                        className="mt-3 max-w-full text-center font-rethink text-sm font-normal leading-relaxed sm:mt-4 sm:max-w-[560px] sm:text-base lg:text-lg text-muted dark:text-paper/60"
                    >
                        Airship Express Courier Services gets your parcels where they need
                        to go, quickly and securely, with real-time tracking every step of
                        the way.
                    </motion.p>

                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate={ready ? "show" : "hidden"}
                        custom={5.5}
                        className="mt-5 flex w-full max-w-sm flex-col gap-3 sm:mt-6 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center"
                    >
                        <motion.a
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            href="https://web.facebook.com/profile.php?id=61571986650033"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-8 font-rethink text-sm font-semibold text-paper shadow-lg shadow-accent/20 transition-colors hover:bg-ink sm:text-base"
                        >
                            Book a Delivery
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </motion.a>
                        <motion.a
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            href="#"
                            className="group flex h-12 items-center justify-center gap-2 rounded-full border px-8 font-rethink text-sm font-semibold transition-colors sm:text-base border-line bg-white text-ink hover:bg-line/40 dark:border-paper/15 dark:bg-paper/5 dark:text-paper dark:hover:bg-paper/10"
                        >
                            <MapPin className="h-4 w-4" />
                            Track Your Package
                        </motion.a>
                    </motion.div>

                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate={ready ? "show" : "hidden"}
                        custom={6.5}
                        className="mt-6 w-full max-w-3xl rounded-3xl border p-3.5 shadow-[0_20px_50px_-25px_rgba(28,27,31,0.15)] sm:mt-8 sm:p-5 lg:mt-10 lg:p-6 border-line bg-gradient-to-b from-white to-line/20 dark:border-paper/10 dark:bg-paper/[0.03] dark:from-transparent dark:to-transparent"
                    >
                        <div className="flex items-center justify-between gap-0.5 sm:gap-4">
                            {deliverySteps.map((step, i, arr) => (
                                <div key={step.label} className="flex flex-1 items-center">
                                    <div className="flex flex-shrink-0 flex-col items-center gap-1.5 sm:gap-2">
                                        <div
                                            className={`flex h-9 w-9 items-center justify-center rounded-full text-paper ring-4 sm:h-10 sm:w-10 md:h-11 md:w-11 ${i === arr.length - 1 ? "bg-accent ring-accent/10" : "bg-ink ring-ink/5 dark:bg-paper/20 dark:ring-paper/5"
                                                }`}
                                        >
                                            <step.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                        <span className="whitespace-nowrap font-rethink text-[9px] font-semibold sm:text-[10px] md:text-xs text-ink dark:text-paper">
                                            {step.label}
                                        </span>
                                    </div>
                                    {i < arr.length - 1 && (
                                        <div className="mx-0.5 h-[2px] flex-1 sm:mx-3 bg-line dark:bg-paper/10" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}