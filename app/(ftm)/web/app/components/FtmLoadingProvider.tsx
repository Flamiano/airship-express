"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import FtmLoader from "./FtmLoader";

/** The sole full-page loader for initial FTM entry and internal link navigation. */
export default function FtmLoadingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [isLoading, setIsLoading] = useState(true);
  const [loaderKey, setLoaderKey] = useState(0);
  const [loaderDuration, setLoaderDuration] = useState(500);
  const [routeReady, setRouteReady] = useState(false);
  const [transitionRequested, setTransitionRequested] = useState(false);
  const pendingPathRef = useRef<string | null>(null);
  const navigationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const showLoader = (event: Event) => {
      const detail = (event as CustomEvent<{ destination?: string }>).detail;
      const destination = detail?.destination;
      if (!destination || pendingPathRef.current) return;
      pendingPathRef.current = destination;
      setLoaderDuration(500);
      setLoaderKey((current) => current + 1);
      setRouteReady(false);
      setTransitionRequested(true);
      setIsLoading(true);
      navigationTimerRef.current = window.setTimeout(() => {
        router.replace(destination);
      }, 500);
    };

    window.addEventListener("ftm:loading", showLoader);
    return () => {
      window.removeEventListener("ftm:loading", showLoader);
      if (navigationTimerRef.current) window.clearTimeout(navigationTimerRef.current);
    };
  }, [router]);

  useEffect(() => {
    if (pendingPathRef.current) {
      if (pathname === pendingPathRef.current) setRouteReady(true);
      return;
    }

    if (/auth/i.test(pathname)) {
      setRouteReady(true);
      return;
    }

    setRouteReady(true);
  }, [pathname]);

  useEffect(() => {
    const prefetch = (event: MouseEvent | FocusEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const destination = new URL(href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      router.prefetch(`${destination.pathname}${destination.search}`);
    };

    document.addEventListener("mouseover", prefetch, true);
    document.addEventListener("focusin", prefetch, true);
    return () => {
      document.removeEventListener("mouseover", prefetch, true);
      document.removeEventListener("focusin", prefetch, true);
    };
  }, [router]);

  useEffect(() => {
    const prefetchNavigationLinks = () => {
      const destinations = new Set<string>();
      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
        const href = link.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        const destination = new URL(href, window.location.href);
        if (destination.origin === window.location.origin && destination.pathname !== pathname) {
          destinations.add(`${destination.pathname}${destination.search}`);
        }
      });
      destinations.forEach((destination) => router.prefetch(destination));
    };

    const idle = window.setTimeout(prefetchNavigationLinks, 0);
    return () => window.clearTimeout(idle);
  }, [pathname, router]);

  useEffect(() => {
    const handleHistoryNavigation = () => {
      setLoaderKey((current) => current + 1);
      setLoaderDuration(500);
      setRouteReady(false);
      setTransitionRequested(true);
      setIsLoading(true);
    };

    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, []);

  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const destination = new URL(href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      if (pendingPathRef.current) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("ftm:loading", {
          detail: { destination: `${destination.pathname}${destination.search}${destination.hash}` },
        })
      );
    };
    document.addEventListener("click", navigate, true);
    return () => document.removeEventListener("click", navigate, true);
  }, [router]);

  const isAuthRoute = /auth/i.test(pathname);
  const showLoader = isLoading && (!isAuthRoute || transitionRequested);

  return <>
    {showLoader && (
      <FtmLoader
        key={loaderKey}
        duration={loaderDuration}
        ready={routeReady}
        onComplete={() => {
          setIsLoading(false);
          setTransitionRequested(false);
          pendingPathRef.current = null;
        }}
      />
    )}
    {!showLoader && children}
  </>;
}
