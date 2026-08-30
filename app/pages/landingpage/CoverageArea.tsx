"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { coverageAreas } from "@/app/lib/coverage-areas";

const PHCoverageMap = dynamic(() => import("@/app/components/PHCoverageMap"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-line/30 dark:bg-paper/5">
            <span className="font-rethink text-xs text-muted dark:text-paper/40">Loading map…</span>
        </div>
    ),
});

export default function CoverageArea() {
    const [selected, setSelected] = useState<string | null>(null);

    return (
        <section className="w-full bg-paper px-4 py-20 transition-colors duration-500 dark:bg-ink sm:px-6 sm:py-28 lg:px-10">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                <span className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent font-rethink sm:text-xs">
                    Where we deliver
                </span>
                <h2 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink font-bricolage dark:text-paper sm:text-5xl md:text-[56px]">
                    Metro Manila coverage
                </h2>
                <p className="mt-4 max-w-xl text-base text-muted font-rethink dark:text-paper/60 sm:text-lg">
                    Each city is color-coded on the map — tap a pin or pick one from the
                    list to jump straight to it.
                </p>
            </div>

            {/* Wide on desktop: map + legend side by side. Stacks full-width on mobile. */}
            <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-[1.7fr_1fr] lg:gap-6">
                <div className="relative z-0 isolate overflow-hidden rounded-3xl border border-line shadow-[0_20px_50px_-25px_rgba(28,27,31,0.25)] dark:border-paper/10">
                    <div className="relative h-[360px] w-full sm:h-[440px] lg:h-[560px]">
                        <PHCoverageMap selectedArea={selected} onSelectArea={setSelected} />
                    </div>
                </div>

                <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-white/60 dark:border-paper/10 dark:bg-paper/[0.03] lg:h-[560px]">
                    <div className="shrink-0 border-b border-dashed border-line px-5 py-4 dark:border-paper/10">
                        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted dark:text-paper/40">
                            Service areas
                        </span>
                        <p className="mt-1 font-bricolage text-lg font-bold text-ink dark:text-paper">
                            {coverageAreas.length} cities covered
                        </p>
                    </div>

                    <div className="flex-1 divide-y divide-dashed divide-line overflow-y-auto dark:divide-paper/10">
                        {coverageAreas.map((area) => {
                            const isSelected = selected === area.name;
                            return (
                                <button
                                    key={area.name}
                                    type="button"
                                    onClick={() => setSelected(area.name)}
                                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-line/30 dark:hover:bg-paper/10 ${isSelected ? "bg-line/40 dark:bg-paper/10" : ""
                                        }`}
                                >
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-ink"
                                        style={{ backgroundColor: area.color }}
                                        aria-hidden
                                    />
                                    <span className="font-rethink text-sm font-medium text-ink dark:text-paper">
                                        {area.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="shrink-0 border-t border-dashed border-line px-5 py-3 dark:border-paper/10">
                        <p className="font-rethink text-xs text-muted dark:text-paper/50">
                            + more areas added regularly
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}