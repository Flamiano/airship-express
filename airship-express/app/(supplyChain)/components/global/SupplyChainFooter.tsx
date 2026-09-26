"use client";

import Link from "next/link";

export function SupplyChainFooter() {
    return (
        <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-0 select-none overflow-hidden h-36 sm:h-48 md:h-60 lg:h-72">
            {/* Giant Background Watermark "AIRSHIP" sitting at the absolute bottom edge without being cut */}
            <span
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-2 sm:left-6 font-extrabold text-[5rem] sm:text-[7.5rem] md:text-[10rem] lg:text-[12.5rem] xl:text-[14rem] tracking-wider text-slate-900/[0.04] dark:text-white/[0.035] leading-none select-none whitespace-nowrap -z-10"
            >
                AIRSHIP
            </span>

            {/* Copyright & Links centered at the very bottom */}
            <div className="pointer-events-auto absolute bottom-2 inset-x-0 z-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium font-rethink text-center px-4">
                <span>© {new Date().getFullYear()} Airship Express. All rights reserved.</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <Link href="#" className="transition-colors hover:text-pink-600 dark:hover:text-pink-400">
                    Privacy Policy
                </Link>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <Link href="#" className="transition-colors hover:text-pink-600 dark:hover:text-pink-400">
                    Terms of Service
                </Link>
            </div>
        </footer>
    );
}

export default SupplyChainFooter;


