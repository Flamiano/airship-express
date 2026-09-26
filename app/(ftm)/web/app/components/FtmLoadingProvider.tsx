"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import ConnectionStatusNotice from "./ConnectionStatusNotice";
import { useFtmSettings } from "./FtmSettingsProvider";

const NAVIGATION_PROGRESS_CAP_MS = 1500;
const stages = [
  { at: 0, label: "Loading cargo" },
  { at: 34, label: "Calculating route" },
  { at: 68, label: "Dispatching rider" },
  { at: 100, label: "Ready for delivery" },
];

function normalizeNavigationLocation(value: string) {
  const url = new URL(value || "/", "http://ftm.local");
  let pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/vrds") pathname = "/vrds/dashboard";
  url.searchParams.sort();
  return `${pathname}${url.search ? `?${url.searchParams.toString()}` : ""}`;
}

function navigationLocationsMatch(current: string, pending: string) {
  return normalizeNavigationLocation(current) === normalizeNavigationLocation(pending);
}

function Wheel({ cx }: { cx: number }) {
  return (
    <motion.g
      style={{ transformOrigin: `${cx}px 82px` }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.55, repeat: Infinity, ease: "linear" }}
    >
      <circle cx={cx} cy="82" r="12" fill="#1C1B1F" stroke="#FCFBF9" strokeWidth="3" />
      <line x1={cx} y1="72" x2={cx} y2="92" stroke="#FCFBF9" strokeWidth="2" />
      <line x1={cx - 10} y1="82" x2={cx + 10} y2="82" stroke="#FCFBF9" strokeWidth="2" />
    </motion.g>
  );
}

function TruckIcon() {
  return (
    <motion.svg
      viewBox="0 0 200 100"
      className="h-16 w-auto sm:h-20"
      aria-hidden="true"
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <rect x="10" y="38" width="100" height="42" rx="4" fill="#1C1B1F" />
      <rect x="10" y="38" width="100" height="8" fill="#E5167E" />
      <path d="M110 50h38l27 22v8h-65z" fill="#1C1B1F" />
      <path d="M118 58h26l15 14h-41z" fill="#FCFBF9" opacity="0.25" />
      <Wheel cx={45} />
      <Wheel cx={152} />
    </motion.svg>
  );
}

export default function FtmLoadingProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useFtmSettings();
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const locationKey = normalizeNavigationLocation(`${pathname}${search ? `?${search}` : ""}`);
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(1);
  const navigationId = useRef(0);
  const navigationActive = useRef(false);
  const clearTimer = useRef<number | null>(null);
  const readyFrame = useRef<number | null>(null);
  const pendingLocation = useRef<string | null>(null);

  const beginNavigation = (destination?: string) => {
    const normalizedDestination = destination ? normalizeNavigationLocation(destination.split("#", 1)[0]) : null;
    if (navigationActive.current && normalizedDestination === pendingLocation.current) return;

    navigationId.current += 1;
    navigationActive.current = true;
    pendingLocation.current = normalizedDestination;
    setProgress(1);
    setIsNavigating(true);

    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    if (readyFrame.current) window.cancelAnimationFrame(readyFrame.current);

    const currentNavigation = navigationId.current;
    clearTimer.current = window.setTimeout(() => {
      if (navigationId.current === currentNavigation) {
        // Progress is visual only. Never let a timer finish a route transition.
        setProgress(90);
      }
    }, NAVIGATION_PROGRESS_CAP_MS);
  };

  useEffect(() => {
    if (!isNavigating) return;
    const duration = NAVIGATION_PROGRESS_CAP_MS;
    const start = performance.now();
    let frameId = 0;
    const tick = (now: number) => {
      const nextProgress = Math.min(90, Math.max(1, Math.round(((now - start) / duration) * 90)));
      setProgress(nextProgress);
      if (nextProgress < 90) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isNavigating]);

  useEffect(() => {
    if (!pendingLocation.current) return;
    if (navigationLocationsMatch(locationKey, pendingLocation.current)) {
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      setProgress(100);

      const currentNavigation = navigationId.current;
      // Effects run after React commits the destination. Two frames ensure the
      // committed route has painted before the old-page overlay is removed.
      readyFrame.current = window.requestAnimationFrame(() => {
        if (navigationId.current !== currentNavigation) return;
        readyFrame.current = window.requestAnimationFrame(() => {
          if (navigationId.current !== currentNavigation) return;
          pendingLocation.current = null;
          navigationActive.current = false;
          setIsNavigating(false);
          readyFrame.current = null;
        });
      });
      return () => {
        if (readyFrame.current) window.cancelAnimationFrame(readyFrame.current);
      };
    }
    setIsNavigating(true);
  }, [locationKey]);

  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-skip-loading], [download]")) return;
      const link = target.closest("a");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const destination = new URL(href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      if (destination.pathname === window.location.pathname && destination.pathname !== "/alerts") return;
      beginNavigation(`${destination.pathname}${destination.search}${destination.hash}`);
    };
    document.addEventListener("click", navigate, true);
    return () => document.removeEventListener("click", navigate, true);
  }, [router]);

  useEffect(() => {
    const handleLoadingEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ destination?: string; mode?: "start" | "stop" }>).detail;
      if (detail?.mode === "stop") {
        navigationId.current += 1;
        pendingLocation.current = null;
        if (clearTimer.current) window.clearTimeout(clearTimer.current);
        if (readyFrame.current) window.cancelAnimationFrame(readyFrame.current);
        navigationActive.current = false;
        setIsNavigating(false);
        setProgress(100);
        return;
      }
      if (!detail?.destination) {
        beginNavigation();
        return;
      }
      beginNavigation(detail.destination);
      router.push(detail.destination);
    };
    window.addEventListener("ftm:loading", handleLoadingEvent);
    return () => window.removeEventListener("ftm:loading", handleLoadingEvent);
  }, [router]);

  useEffect(() => {
    if (!settings.system.navigationPrefetch) return;
    const prefetchedRoutes = new Set<string>();
    const prefetch = (event: MouseEvent | FocusEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      const href = link?.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const destination = new URL(href, window.location.href);
      if (destination.origin === window.location.origin && destination.href !== window.location.href) {
        const route = `${destination.pathname}${destination.search}`;
        if (prefetchedRoutes.has(route)) return;
        prefetchedRoutes.add(route);
        router.prefetch(route);
      }
    };
    document.addEventListener("pointerover", prefetch, true);
    document.addEventListener("focusin", prefetch, true);
    return () => {
      document.removeEventListener("pointerover", prefetch, true);
      document.removeEventListener("focusin", prefetch, true);
    };
  }, [router, settings.system.navigationPrefetch]);

  useEffect(() => () => {
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    if (readyFrame.current) window.cancelAnimationFrame(readyFrame.current);
  }, []);

  const currentStage = [...stages].reverse().find((item) => progress >= item.at) ?? stages[0];

  return (
    <>
      <ConnectionStatusNotice />
      {isNavigating && (
        <div className="pointer-events-none fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#fff7fb] via-[#fcfbf9] to-[#ffe8f2] px-6" role="status" aria-live="polite" aria-label="Loading page">
          <Image src="/airship-logo.png" alt="Airship Express" width={180} height={50} priority className="h-10 w-auto object-contain" />
          <div className="flex w-full max-w-xs flex-col items-center gap-5">
            <TruckIcon />
            <div className="h-[2px] w-full overflow-hidden rounded-full">
              <motion.div className="h-full w-full" style={{ backgroundImage: "repeating-linear-gradient(90deg, #1C1B1F 0 12px, transparent 12px 24px)" }} animate={{ backgroundPositionX: ["0px", "-48px"] }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }} />
            </div>
            <div className="flex w-full flex-col items-center gap-3">
              <span className="font-bricolage text-4xl font-extrabold tracking-[-0.02em] text-[#1C1B1F] sm:text-5xl">{progress}%</span>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#EAEAEA]"><motion.div className="h-full rounded-full bg-[#E5167E]" animate={{ width: `${progress}%` }} transition={{ duration: progress === 100 ? 0 : 0.15, ease: "linear" }} /></div>
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#6B6B76]">{currentStage.label}</span>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
