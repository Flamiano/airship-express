"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Zap, Clock, Wallet, Package } from "lucide-react";

const services = [
    {
        code: "TRK-2026-01",
        icon: Zap,
        title: "Same-Day Delivery",
        desc: "Book before cutoff and your parcel goes out the same day, tracked door to door.",
    },
    {
        code: "TRK-2026-02",
        icon: Clock,
        title: "Next-Day Delivery",
        desc: "Standard scheduled deliveries across Metro Manila at a lower rate.",
    },
    {
        code: "TRK-2026-03",
        icon: Wallet,
        title: "COD Remittance",
        desc: "We collect cash-on-delivery payments and remit them straight to your account.",
    },
    {
        code: "TRK-2026-04",
        icon: Package,
        title: "Business & Bulk Shipments",
        desc: "Recurring pickups for online sellers moving high volumes of parcels daily.",
    },
];

// barcode
function barcodePattern(seed) {
    const widths = [];
    let n = seed * 9301 + 49297;
    for (let i = 0; i < 22; i++) {
        n = (n * 9301 + 49297) % 233280;
        widths.push(2 + Math.floor((n / 233280) * 5));
    }
    return widths;
}

export default function Services() {
    const reduceMotion = useReducedMotion();

    return (
        <section id="services" className="w-full bg-paper px-6 py-20 transition-colors duration-500 dark:bg-ink sm:py-28">
            <div className="mx-auto mb-16 flex max-w-3xl flex-col items-center text-center sm:mb-24">
                <span className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent font-rethink sm:text-xs">
                    Manifest — 4 services
                </span>
                <h2 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink font-bricolage dark:text-paper sm:text-5xl md:text-[56px]">
                    Delivery, done right
                </h2>
                <p className="mt-4 max-w-xl text-base text-muted font-rethink dark:text-paper/60 sm:text-lg">
                    Whether it&apos;s a single parcel or hundreds a day, we&apos;ve got a service built for it.
                </p>
            </div>

            {/* desktop */}
            <div className="relative mx-auto hidden w-full max-w-6xl sm:block">
                <div
                    aria-hidden
                    className="absolute top-6 h-px border-t-2 border-dashed border-line dark:border-paper/15"
                    style={{ left: "12.5%", right: "12.5%" }}
                />
                <motion.div
                    aria-hidden
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.65, 0, 0.35, 1] }}
                    className="absolute top-6 h-[2px] origin-left bg-accent"
                    style={{ left: "12.5%", right: "12.5%" }}
                />

                <div className="grid grid-cols-4 gap-6">
                    {services.map((s, i) => (
                        <div key={s.code} className="flex flex-col items-center">
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.25 + i * 0.18, ease: "backOut" }}
                                className="z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-paper text-ink dark:bg-ink dark:text-paper"
                            >
                                <s.icon className="h-5 w-5" />
                            </motion.div>

                            <div className="h-6 w-px border-l-2 border-dashed border-line dark:border-paper/15" />

                            <WaybillCard s={s} index={i} reduceMotion={reduceMotion} />
                        </div>
                    ))}
                </div>
            </div>

            {/* mobile */}
            <div className="relative mx-auto flex max-w-md flex-col sm:hidden">
                <div
                    aria-hidden
                    className="absolute bottom-6 left-6 top-6 w-px border-l-2 border-dashed border-line dark:border-paper/15"
                />
                <motion.div
                    aria-hidden
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: reduceMotion ? 0 : 1, ease: [0.65, 0, 0.35, 1] }}
                    className="absolute bottom-6 left-6 top-6 w-[2px] origin-top bg-accent"
                />
                <div className="flex flex-col gap-8">
                    {services.map((s, i) => (
                        <div key={s.code} className="relative flex gap-4 pl-0">
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                viewport={{ once: true, margin: "-60px" }}
                                transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.15 + i * 0.12, ease: "backOut" }}
                                className="z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-paper text-ink dark:bg-ink dark:text-paper"
                            >
                                <s.icon className="h-5 w-5" />
                            </motion.div>
                            <div className="flex-1 pt-0.5">
                                <WaybillCard s={s} index={i} reduceMotion={reduceMotion} compact />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function WaybillCard({ s, index, reduceMotion, compact }) {
    const bars = barcodePattern(index + 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.4 + index * 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={`group relative w-full overflow-hidden rounded-lg border border-line bg-paper shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors focus-within:ring-2 focus-within:ring-accent dark:border-paper/10 dark:bg-ink ${compact ? "mt-0" : "mt-2"
                }`}
        >
            <span aria-hidden className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-paper transition-colors dark:bg-ink" />
            <span aria-hidden className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-paper transition-colors dark:bg-ink" />

            <div className="border-b border-dashed border-line px-6 py-4 dark:border-paper/15">
                <span className="font-rethink text-[10px] font-semibold uppercase tracking-[0.18em] text-muted dark:text-paper/40">
                    {s.code}
                </span>
                <h3 className="mt-1 text-lg font-bold text-ink font-bricolage dark:text-paper sm:text-xl">
                    {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted font-rethink dark:text-paper/60">
                    {s.desc}
                </p>
            </div>

            <div className="relative flex h-8 items-center gap-[3px] overflow-hidden px-6">
                {bars.map((w, bi) => (
                    <span key={bi} className="h-4 shrink-0 bg-ink/70 dark:bg-paper/40" style={{ width: `${w}px` }} />
                ))}
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-8 -translate-x-full bg-gradient-to-r from-transparent via-accent/70 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:translate-x-[calc(100%+2rem)] group-hover:opacity-100"
                />
            </div>
        </motion.div>
    );
}