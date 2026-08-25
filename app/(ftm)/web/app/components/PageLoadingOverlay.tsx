"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function PageLoadingOverlay() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  useEffect(() => {
    const handleNavigationStart = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const nextUrl = new URL(href, window.location.origin);
      if (nextUrl.origin !== window.location.origin || nextUrl.pathname === window.location.pathname) return;

      setLoading(true);
    };

    document.addEventListener("click", handleNavigationStart, true);
    return () => document.removeEventListener("click", handleNavigationStart, true);
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#fcfbf9]/80 p-4 backdrop-blur-sm" role="status" aria-label="Loading page">
      <div className="flex items-center gap-3 rounded-xl border border-pink-100 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-lg">
        <span className="material-symbols-outlined animate-spin text-pink-600">progress_activity</span>
        Loading page…
      </div>
    </div>
  );
}
