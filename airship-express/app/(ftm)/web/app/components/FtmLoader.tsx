"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

const stages = [
  { at: 0, label: "Loading cargo" },
  { at: 34, label: "Calculating route" },
  { at: 68, label: "Dispatching rider" },
  { at: 100, label: "Ready for delivery" },
];

function Wheel({ cx }: { cx: number }) {
  return <motion.g style={{ transformOrigin: `${cx}px 82px` }} animate={{ rotate: 360 }} transition={{ duration: 0.55, repeat: Infinity, ease: "linear" }}><circle cx={cx} cy="82" r="12" fill="#1C1B1F" stroke="#FCFBF9" strokeWidth="3" /><line x1={cx} y1="72" x2={cx} y2="92" stroke="#FCFBF9" strokeWidth="2" /><line x1={cx - 10} y1="82" x2={cx + 10} y2="82" stroke="#FCFBF9" strokeWidth="2" /></motion.g>;
}

function TruckIcon() {
  return <motion.svg viewBox="0 0 200 100" className="h-16 w-auto sm:h-20" aria-hidden="true" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}><rect x="10" y="38" width="100" height="42" rx="4" fill="#1C1B1F" /><rect x="10" y="38" width="100" height="8" fill="#E5167E" /><path d="M110 50h38l27 22v8h-65z" fill="#1C1B1F" /><path d="M118 58h26l15 14h-41z" fill="#FCFBF9" opacity="0.25" /><Wheel cx={45} /><Wheel cx={152} /></motion.svg>;
}

export default function FtmLoader({ onComplete, duration = 500, ready = true }: { onComplete: () => void; duration?: number; ready?: boolean }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "done">("loading");
  const readyRef = useRef(ready);

  useEffect(() => {
    readyRef.current = ready;
    if (ready && progress >= 100) setPhase("done");
  }, [progress, ready]);

  useEffect(() => {
    const start = Date.now();
    let completionTimer: number | undefined;
    const timer = window.setInterval(() => {
      const nextProgress = Math.min(100, Math.round(((Date.now() - start) / duration) * 100));
      setProgress(nextProgress);
      if (nextProgress >= 100 && readyRef.current) {
        window.clearInterval(timer);
        completionTimer = window.setTimeout(() => setPhase("done"), 0);
      }
    }, 50);
    return () => {
      window.clearInterval(timer);
      if (completionTimer) window.clearTimeout(completionTimer);
    };
  }, [duration]);

  const stage = [...stages].reverse().find((item) => progress >= item.at) ?? stages[0];
  const visibleProgress = ready ? 100 : Math.min(progress, 99);
  const visibleStage = [...stages].reverse().find((item) => visibleProgress >= item.at) ?? stages[0];
  return <motion.div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-10 bg-gradient-to-br from-[#fff7fb] via-[#FCFBF9] to-[#ffe8f2] px-6" initial={{ y: 0 }} animate={{ y: phase === "done" ? "-100%" : 0 }} transition={{ duration: 0.1, ease: "easeOut" }} onAnimationComplete={() => { if (phase === "done") onComplete(); }}><Image src="/airship-logo.png" alt="Airship Express" width={160} height={44} priority className="relative z-10 h-9 w-auto object-contain" /><div className="relative z-10 flex w-full max-w-xs flex-col items-center gap-6"><TruckIcon /><div className="h-[2px] w-full overflow-hidden rounded-full"><motion.div className="h-full w-full" style={{ backgroundImage: "repeating-linear-gradient(90deg, #1C1B1F 0 12px, transparent 12px 24px)" }} animate={{ backgroundPositionX: ["0px", "-48px"] }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }} /></div><div className="flex w-full flex-col items-center gap-3"><span className="text-4xl font-extrabold tracking-[-0.02em] text-[#1C1B1F] sm:text-5xl">{visibleProgress}%</span><div className="h-1 w-full overflow-hidden rounded-full bg-[#EAEAEA]"><motion.div className="h-full rounded-full bg-[#E5167E]" animate={{ width: `${visibleProgress}%` }} transition={{ duration: 0.15, ease: "linear" }} /></div><span className="text-xs font-medium uppercase tracking-[0.14em] text-[#6B6B76]">{visibleStage.label}</span></div></div></motion.div>;
}
