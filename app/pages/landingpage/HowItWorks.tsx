"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MessageCircle, Bike, MapPinned } from "lucide-react";

const steps = [
    {
        number: "01",
        icon: MessageCircle,
        title: "Book a pickup",
        desc: "Message us on Facebook with your parcel details and pickup address.",
    },
    {
        number: "02",
        icon: Bike,
        title: "We collect it",
        desc: "A rider picks up your parcel at your requested time and location.",
    },
    {
        number: "03",
        icon: MapPinned,
        title: "Track and deliver",
        desc: "Follow your parcel in real time until it lands in the recipient's hands.",
    },
];

export default function HowItWorks() {
    const reduceMotion = useReducedMotion();

    return (
        <section className="w-full bg-[#1c1b1f] py-20 sm:py-28">
            {/* header */}
            <div className="mx-auto mb-14 flex max-w-3xl flex-col items-center px-6 text-center sm:mb-20">
                <span className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent font-rethink sm:text-xs">
                    The process
                </span>
                <h2 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white font-bricolage sm:text-5xl md:text-[56px]">
                    How it works
                </h2>
            </div>

            {/* ledger, full width */}
            <div className="relative w-full border-y border-dashed border-white/10">
                <motion.div
                    aria-hidden
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: reduceMotion ? 0 : 1.2, ease: [0.65, 0, 0.35, 1] }}
                    className="absolute left-[71px] top-0 bottom-0 w-[2px] origin-top bg-accent sm:left-[95px] lg:left-[119px]"
                />

                {steps.map((s, i) => (
                    <motion.div
                        key={s.number}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                        className={`grid w-full grid-cols-[72px_1fr] border-dashed border-white/10 sm:grid-cols-[96px_1fr] lg:grid-cols-[120px_1fr] ${i !== 0 ? "border-t" : ""
                            }`}
                    >
                        {/* marker */}
                        <div className="flex flex-col items-center justify-center gap-2 border-r border-dashed border-white/10 py-10">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-accent bg-[#1c1b1f] text-accent">
                                <s.icon className="h-5 w-5" />
                            </div>
                            <span className="font-rethink text-[11px] font-semibold text-accent">{s.number}</span>
                        </div>

                        {/* content */}
                        <div className="relative flex flex-col gap-2 overflow-hidden py-10 pl-6 pr-6 sm:pl-10 sm:pr-10 lg:flex-row lg:items-baseline lg:gap-10 lg:pl-12">
                            <span
                                aria-hidden
                                className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 select-none font-bricolage text-[140px] font-extrabold leading-none text-white/[0.04] xl:block"
                            >
                                {s.number}
                            </span>

                            <h3 className="shrink-0 font-bricolage text-2xl font-bold text-white lg:w-64 lg:text-3xl">
                                {s.title}
                            </h3>
                            <p className="max-w-xl text-sm leading-relaxed text-white/60 font-rethink sm:text-base lg:border-l lg:border-dashed lg:border-white/10 lg:pl-10">
                                {s.desc}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}