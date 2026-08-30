"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { Truck } from "lucide-react";

const stops = [
    {
        src: "/images/723562191_122113968482732888_3268815767835544895_n.jpg",
        tag: "Full coverage across Metro Manila, free pickup included",
    },
    {
        src: "/images/727519680_122115371912732888_9195368293136817016_n.jpg",
        tag: "Authorized drop-off for Shopee, Lazada, J&T & more",
    },
    {
        src: "/images/735317471_122116417382732888_4342694971203913098_n.jpg",
        tag: "Free pickup, free packaging, trusted handover",
    },
    {
        src: "/images/740425573_122117122490732888_1639837946380566561_n.jpg",
        tag: "Nationwide delivery with zero handling fees",
    },
];

function StopFrame({
    src,
    tag,
    index,
    orientation,
}: {
    src: string;
    tag: string;
    index: number;
    orientation: "column" | "row";
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={`flex w-full items-center gap-4 ${orientation === "column" ? "max-w-[220px] flex-col" : "flex-row"
                }`}
        >
            <div
                className={`relative aspect-[4/5] shrink-0 overflow-hidden rounded-2xl border border-[#EAEAEA] bg-[#F3F2EF] shadow-[0_16px_36px_-20px_rgba(28,27,31,0.28)] dark:border-paper/10 dark:bg-paper/[0.04] ${orientation === "column" ? "w-full" : "w-24"
                    }`}
            >
                <Image
                    src={src}
                    alt="Airship Express promotional graphic"
                    fill
                    sizes="(max-width: 1024px) 40vw, 220px"
                    className="object-contain p-2"
                />
            </div>
            <p
                className={`font-rethink text-xs font-medium text-[#6B6B76] dark:text-paper/60 ${orientation === "column" ? "text-center" : "text-left"
                    }`}
            >
                <span className="mr-1.5 block font-bricolage text-[10px] font-bold uppercase tracking-[0.14em] text-[#E5167E] sm:inline">
                    Stop {String(index + 1).padStart(2, "0")}
                </span>
                {tag}
            </p>
        </motion.div>
    );
}

export default function GallerySection() {
    const railRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: railRef,
        offset: ["start 0.85", "end 0.35"],
    });

    const truckLeft = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
    const truckTop = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
    const truckTilt = useTransform(scrollYProgress, [0, 0.06, 0.94, 1], [-6, 0, 0, 6]);

    return (
        <section id="gallery" className="w-full bg-white px-6 py-20 transition-colors duration-500 dark:bg-ink sm:py-28">
            <div className="mx-auto mb-16 flex max-w-3xl flex-col items-center text-center sm:mb-24">
                <span className="mb-3 font-rethink text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E5167E] sm:text-xs">
                    How we deliver
                </span>
                <h2 className="font-bricolage text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#1C1B1F] dark:text-paper sm:text-5xl md:text-[56px]">
                    Everything We Deliver, In Four Stops
                </h2>
                <p className="mt-4 font-rethink text-base text-[#6B6B76] dark:text-paper/60 sm:text-lg">
                    Four things worth knowing before you book with us.
                </p>
            </div>

            <div ref={railRef} className="relative mx-auto max-w-5xl">
                <div className="absolute left-0 right-0 top-1/2 hidden h-[2px] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,#D9D9D9_0px,#D9D9D9_8px,transparent_8px,transparent_18px)] dark:bg-[repeating-linear-gradient(90deg,rgba(252,251,249,0.15)_0px,rgba(252,251,249,0.15)_8px,transparent_8px,transparent_18px)] lg:block" />
                <div className="absolute left-[27px] top-0 bottom-0 w-[2px] bg-[repeating-linear-gradient(180deg,#D9D9D9_0px,#D9D9D9_8px,transparent_8px,transparent_18px)] dark:bg-[repeating-linear-gradient(180deg,rgba(252,251,249,0.15)_0px,rgba(252,251,249,0.15)_8px,transparent_8px,transparent_18px)] lg:hidden" />

                <motion.div
                    style={{ left: truckLeft, rotate: truckTilt }}
                    className="absolute top-1/2 z-20 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#1C1B1F] text-white shadow-[0_10px_24px_-6px_rgba(28,27,31,0.5)] dark:bg-paper dark:text-ink lg:flex"
                >
                    <Truck className="h-4 w-4" />
                </motion.div>
                <motion.div
                    style={{ top: truckTop }}
                    className="absolute left-[27px] z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#1C1B1F] text-white shadow-[0_10px_24px_-6px_rgba(28,27,31,0.5)] dark:bg-paper dark:text-ink lg:hidden"
                >
                    <Truck className="h-4 w-4" />
                </motion.div>

                <div className="hidden lg:grid lg:grid-cols-4 lg:gap-6">
                    {stops.map((stop, i) => {
                        const above = i % 2 === 0;
                        return (
                            <div
                                key={stop.src}
                                className={`flex flex-col items-center ${above ? "justify-end" : "justify-start"
                                    }`}
                            >
                                {above && (
                                    <div className="mb-6">
                                        <StopFrame src={stop.src} tag={stop.tag} index={i} orientation="column" />
                                    </div>
                                )}
                                <div className="h-8 w-[2px] bg-[#E5167E]/30" />
                                <div className="relative z-10 h-3 w-3 rounded-full bg-[#E5167E] ring-[6px] ring-white dark:ring-ink" />
                                <div className="h-8 w-[2px] bg-[#E5167E]/30" />
                                {!above && (
                                    <div className="mt-6">
                                        <StopFrame src={stop.src} tag={stop.tag} index={i} orientation="column" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-10 pl-16 lg:hidden">
                    {stops.map((stop, i) => (
                        <div key={stop.src} className="relative">
                            <div className="absolute -left-[47px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#E5167E] ring-[6px] ring-white dark:ring-ink" />
                            <StopFrame src={stop.src} tag={stop.tag} index={i} orientation="row" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}