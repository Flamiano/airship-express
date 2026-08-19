"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
    ArrowRight,
    MapPin,
    Package,
    Truck,
    Boxes,
    TrendingUp,
    TrendingDown,
    Minus,
} from "lucide-react";

const kpis = [
    { label: "Parcels In Transit", value: "482", delta: "+12%", trend: "up" as const },
    { label: "On-Time Rate", value: "98.4%", delta: "+0.6%", trend: "up" as const },
    { label: "Active Riders", value: "36", delta: "Steady", trend: "flat" as const },
    { label: "Avg. Pickup Time", value: "18 min", delta: "-4%", trend: "down" as const },
];

const weeklyBars = [
    { day: "Mon", value: 40 },
    { day: "Tue", value: 55 },
    { day: "Wed", value: 48 },
    { day: "Thu", value: 70 },
    { day: "Fri", value: 65 },
    { day: "Sat", value: 90 },
    { day: "Sun", value: 60 },
];

const feed = [
    { time: "8:42 AM", code: "AX-2291", status: "Picked up", place: "Quezon City" },
    { time: "8:53 AM", code: "AX-2276", status: "Delivered", place: "Makati CBD" },
    { time: "9:01 AM", code: "AX-2299", status: "In Transit", place: "Binondo, Manila" },
];

const fleet = [
    { icon: Package, name: "Rider / Motorcycle", capacity: "Up to 5 kg", bestFor: "Same-day metro parcels" },
    { icon: Truck, name: "L300 / Multicab", capacity: "Up to 500 kg", bestFor: "Bulk pickups & business runs" },
    { icon: Boxes, name: "6-Wheeler Truck", capacity: "Up to 3,000 kg", bestFor: "Warehouse transfers & freight" },
];

function statusClasses(status: string) {
    if (status === "Delivered") return "bg-accent/10 text-accent";
    if (status === "In Transit") return "bg-white/10 text-white";
    return "bg-white/5 text-white/70";
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
    if (trend === "up") return <TrendingUp className="h-3.5 w-3.5" />;
    if (trend === "down") return <TrendingDown className="h-3.5 w-3.5" />;
    return <Minus className="h-3.5 w-3.5" />;
}

export default function CommandCenter() {
    return (
        <section id="contact" className="w-full bg-paper px-6 py-20 transition-colors duration-500 dark:bg-ink sm:py-28">
            <div className="mx-auto mb-12 flex max-w-3xl flex-col items-center text-center sm:mb-16">
                <span className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent font-rethink sm:text-xs">
                    Command center
                </span>
                <h2 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink font-bricolage dark:text-paper sm:text-5xl md:text-[56px]">
                    One system, every shipment
                </h2>
                <p className="mt-4 max-w-xl text-base text-muted font-rethink dark:text-paper/60 sm:text-lg">
                    From live dispatch status to the fleet on standby, here&apos;s how your parcel
                    actually moves — and your shipping label, ready below.
                </p>
            </div>

            <div className="relative mx-auto w-full max-w-6xl">
                <div className="absolute -top-8 right-6 z-20 hidden -rotate-6 rounded-sm border-4 border-paper bg-paper shadow-lg dark:border-ink dark:bg-ink sm:block">
                    <div className="relative h-24 w-20 overflow-hidden">
                        <Image
                            src="/images/735317471_122116417382732888_4342694971203913098_n.jpg"
                            alt="Airship Express courier handing a parcel to a customer"
                            fill
                            sizes="80px"
                            className="object-cover"
                        />
                    </div>
                </div>

                {/* always-dark manifest panel — fixed colors, no theme flip */}
                <div className="rounded-t-2xl border border-white/10 bg-[#1c1b1f] p-6 sm:p-10">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-white/10 pb-5">
                        <span className="flex items-center gap-2 font-rethink text-xs font-semibold uppercase tracking-[0.14em] text-white">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                            System Operational
                        </span>
                        <span className="rounded-full border border-white/15 px-3 py-1 font-rethink text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">
                            Sample data · Illustrative
                        </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {kpis.map((k, i) => (
                            <motion.div
                                key={k.label}
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-60px" }}
                                transition={{ duration: 0.4, delay: i * 0.06 }}
                                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                            >
                                <span className="font-rethink text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
                                    {k.label}
                                </span>
                                <div className="mt-2 flex items-end justify-between">
                                    <span className="font-bricolage text-xl font-bold text-white sm:text-2xl">
                                        {k.value}
                                    </span>
                                    <span
                                        className={`flex items-center gap-1 font-rethink text-xs font-medium ${k.trend === "flat" ? "text-white/40" : "text-accent"
                                            }`}
                                    >
                                        <TrendIcon trend={k.trend} />
                                        {k.delta}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                        <span className="font-rethink text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
                            Deliveries this week
                        </span>
                        <div className="mt-4 flex h-20 items-end gap-2">
                            {weeklyBars.map((b, i) => (
                                <div key={b.day} className="flex flex-1 flex-col items-center gap-2">
                                    <motion.div
                                        initial={{ height: 0 }}
                                        whileInView={{ height: `${b.value}%` }}
                                        viewport={{ once: true, margin: "-60px" }}
                                        transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                                        className="w-full rounded-t-md bg-accent/70"
                                    />
                                    <span className="font-rethink text-[9px] font-medium text-white/40">{b.day}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10">
                        {feed.map((f, i) => (
                            <motion.div
                                key={f.code}
                                initial={{ opacity: 0, x: -8 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-60px" }}
                                transition={{ duration: 0.35, delay: i * 0.06 }}
                                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-[10px] text-white/40">{f.time}</span>
                                    <span className="font-mono text-xs font-semibold text-white/70">{f.code}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-rethink text-xs text-white/50">{f.place}</span>
                                    <span
                                        className={`rounded-full px-2.5 py-1 font-rethink text-[10px] font-semibold uppercase tracking-[0.06em] ${statusClasses(
                                            f.status
                                        )}`}
                                    >
                                        {f.status}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-8 border-t border-dashed border-white/10 pt-6">
                        <span className="font-rethink text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
                            Fleet on standby
                        </span>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {fleet.map((v, i) => (
                                <motion.div
                                    key={v.name}
                                    initial={{ opacity: 0, y: 12 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-60px" }}
                                    transition={{ duration: 0.4, delay: i * 0.08 }}
                                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
                                            <v.icon className="h-4 w-4" />
                                        </div>
                                        <span className="font-rethink text-sm font-semibold text-white">{v.name}</span>
                                    </div>
                                    <p className="mt-2 font-bricolage text-lg font-bold text-white">{v.capacity}</p>
                                    <p className="font-rethink text-xs text-white/50">{v.bestFor}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <p className="mt-6 font-rethink text-xs text-white/30">
                        Figures shown are for illustration. Connect this panel to your real dispatch data whenever you&apos;re ready.
                    </p>
                </div>

                <div
                    aria-hidden
                    className="h-3 bg-[#1c1b1f]"
                    style={{
                        maskImage: "radial-gradient(circle 5px at 8px 50%, transparent 99%, black 100%)",
                        WebkitMaskImage: "radial-gradient(circle 5px at 8px 50%, transparent 99%, black 100%)",
                        maskRepeat: "repeat-x",
                        WebkitMaskRepeat: "repeat-x",
                        maskSize: "18px 100%",
                        WebkitMaskSize: "18px 100%",
                    }}
                />

                <div className="relative rounded-b-2xl border border-t-0 border-ink bg-paper px-6 py-10 text-center transition-colors duration-500 dark:border-paper/10 dark:bg-[#151417] sm:px-14 sm:py-14">
                    <p className="font-mono text-xs tracking-[0.15em] text-muted dark:text-paper/50">AX 4471 0562 PH</p>

                    <span className="mx-auto mt-4 mb-6 inline-block -rotate-3 rounded-[3px] border-2 border-accent px-3 py-1 font-rethink text-xs font-bold uppercase tracking-[0.14em] text-accent mix-blend-multiply dark:mix-blend-normal">
                        Ready to ship
                    </span>

                    <div className="mx-auto grid max-w-md grid-cols-1 gap-4 border-y border-dashed border-line py-5 text-left dark:border-paper/10 sm:grid-cols-2">
                        <div>
                            <span className="font-rethink text-[10px] font-semibold uppercase tracking-[0.14em] text-muted dark:text-paper/40">
                                From
                            </span>
                            <p className="mt-1 font-rethink text-sm font-semibold text-ink dark:text-paper">Airship Express</p>
                            <p className="font-rethink text-xs text-muted dark:text-paper/50">Metro Manila, PH</p>
                        </div>
                        <div>
                            <span className="font-rethink text-[10px] font-semibold uppercase tracking-[0.14em] text-muted dark:text-paper/40">
                                To
                            </span>
                            <p className="mt-1 flex items-center gap-1.5 font-rethink text-sm font-semibold italic text-muted dark:text-paper/50">
                                <MapPin className="h-3.5 w-3.5 text-accent" />
                                your address here
                            </p>
                        </div>
                    </div>

                    <h3 className="mx-auto mt-8 max-w-md text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink font-bricolage dark:text-paper sm:text-4xl">
                        Ready to send your first parcel?
                    </h3>
                    <p className="mx-auto mt-3 max-w-sm font-rethink text-sm text-muted dark:text-paper/60 sm:text-base">
                        Message us on Facebook and we&apos;ll schedule your pickup today.
                    </p>

                    <motion.a
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        href="https://web.facebook.com/profile.php?id=61571986650033"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-8 font-rethink text-sm font-semibold text-paper transition-colors hover:bg-ink sm:text-base"
                    >
                        Message Us on Facebook
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </motion.a>
                </div>
            </div>
        </section>
    );
}