"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = "spnc-last-activity";

type ShellContextType = {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  mounted: boolean;
  role: string | null;
  roleLoading: boolean;
};

const ShellContext = createContext<ShellContextType | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTimedOut, setSessionTimedOut] = useState(false);
  const lastActivityRef = useRef<number | null>(null);

  // --- Establish session state on mount / route change ---
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMounted(true);
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") setTheme(saved);

      if (pathname === "/spnc/app/login") {
        sessionStorage.removeItem(LAST_ACTIVITY_KEY);
        setSessionActive(false);
        setRole(null);
        setSessionTimedOut(false);
        setRoleLoading(false);
        return;
      }

      // FIX: trust the local marker set at login immediately, so the
      // inactivity timer effect below can start right away instead of
      // waiting on (and depending on the success of) the network call.
      const hasLocalSession = sessionStorage.getItem(LAST_ACTIVITY_KEY) !== null;
      if (hasLocalSession) setSessionActive(true);

      fetch("/spnc/app/api/sessions", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          setSessionActive(response.ok);
          setRole(response.ok ? data.user?.role || null : null);
          if (!response.ok) {
            // Server says the session is genuinely invalid — clear the marker too.
            sessionStorage.removeItem(LAST_ACTIVITY_KEY);
          }
        })
        .catch(() => {
          // A network hiccup on this check shouldn't kill a session we
          // already trust locally from the login-time marker.
          if (!hasLocalSession) {
            setSessionActive(false);
            setRole(null);
          }
        })
        .finally(() => setRoleLoading(false));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  // --- Inactivity timer ---
  useEffect(() => {
    if (roleLoading || !sessionActive || sessionTimedOut) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const savedActivity = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY));
    lastActivityRef.current = Number.isFinite(savedActivity) && savedActivity > 0 ? savedActivity : Date.now();
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivityRef.current));

    const signOutForInactivity = async () => {
      await fetch("/spnc/app/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "session_timeout" }),
      }).catch(() => undefined);
      sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      setSessionActive(false);
      setRole(null);
      setSessionTimedOut(true);
    };

    const scheduleTimeout = () => {
      clearTimeout(timeoutId);
      const lastActivity = lastActivityRef.current ?? Date.now();
      const remaining = Math.max(0, SESSION_TIMEOUT_MS - (Date.now() - lastActivity));
      timeoutId = setTimeout(signOutForInactivity, remaining);
    };

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      sessionStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivityRef.current));
      scheduleTimeout();
    };

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    // FIX: use capture phase. "scroll" (and some other events) don't bubble
    // to window, so a bubble-phase listener misses activity inside any
    // internally-scrollable container. Capture phase catches it regardless
    // of where in the DOM it fires.
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true, capture: true })
    );
    scheduleTimeout();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity, { capture: true })
      );
    };
  }, [roleLoading, sessionActive, sessionTimedOut]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  }

  function goToLogin() {
    setSessionTimedOut(false);
    router.push("/spnc/app/login");
    router.refresh();
  }

  return (
    <ShellContext.Provider value={{ sidebarOpen, setSidebarOpen, theme, toggleTheme, mounted, role, roleLoading }}>
      {children}
      {sessionTimedOut && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 px-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-timeout-title"
        >
          <div
            className="rounded-md border border-[#D9D9D9] bg-white px-6 py-10 text-center shadow-[0_18px_45px_rgba(0,0,0,0.2)] sm:px-8"
            style={{ width: "min(400px, calc(100vw - 3rem))" }}
          >
            <h2
              id="session-timeout-title"
              className="text-3xl font-semibold text-[#30343B]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Session timeout
            </h2>
            <p className="mx-auto mt-6 max-w-[520px] text-base leading-7 text-[#4B4F56]">
              You have been logged out due to inactivity.
            </p>
            <button
              type="button"
              onClick={goToLogin}
              className="mt-6 inline-flex min-w-[114px] items-center justify-center rounded-md bg-[#F2419B] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#F55CAB]"
            >
              Login
            </button>
          </div>
        </div>
      )}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside ShellProvider");
  return ctx;
}
