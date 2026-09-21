"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { persistAuthUser, signOut } from "../lib/auth";
import { getCurrentRole, hasPathAccess, normalizeRole } from "../lib/roleAccess";

const INACTIVITY_TIMEOUT_MS = 1 * 60 * 1000;
const INACTIVITY_WARNING_MS = 30 * 1000;
const PUBLIC_PATHS = new Set(["/", "/ftmAuth"]);
export default function FtmSecurityProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const lastActivity = useRef(Date.now());
  const signingOut = useRef(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [countdown, setCountdown] = useState(Math.ceil(INACTIVITY_WARNING_MS / 1000));
  const [authResolved, setAuthResolved] = useState(PUBLIC_PATHS.has(pathname));

  const handleSessionExpired = async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    setWarningOpen(false);
    await signOut();
    router.replace("/ftmAuth?reason=timeout");
  };

  const handleContinueSession = () => {
    lastActivity.current = Date.now();
    setWarningOpen(false);
    setCountdown(Math.ceil(INACTIVITY_WARNING_MS / 1000));
  };

  useEffect(() => {
    signingOut.current = false;
    setAuthResolved(PUBLIC_PATHS.has(pathname));
    lastActivity.current = Date.now();
    setWarningOpen(false);
    setCountdown(Math.ceil(INACTIVITY_WARNING_MS / 1000));
  }, [pathname]);

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) return;

    let active = true;
    const enforceSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active || signingOut.current) return;

      if (error) {
        await supabase.auth.signOut({ scope: "local" });
        persistAuthUser(null);
        setAuthResolved(false);
        router.replace(`/ftmAuth?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const user = data.session?.user;
      if (!user) {
        setAuthResolved(false);
        router.replace(`/ftmAuth?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const role = getCurrentRole() ?? normalizeRole(user.app_metadata?.role ?? user.user_metadata?.role ?? user.role);
      setAuthResolved(true);
      if (!role || !hasPathAccess(role, pathname)) {
        router.replace(`/unauthorized?from=${encodeURIComponent(pathname)}`);
      }
    };

    void enforceSession();
    const onAuthStateChange = () => void enforceSession();
    const { data: authSubscription } = supabase.auth.onAuthStateChange(onAuthStateChange);
    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [pathname, router]);

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) return;

    const handleOfflineLogout = () => {
      if (signingOut.current) return;
      void handleSessionExpired();
    };

    const handleOnline = () => {
      if (warningOpen) setWarningOpen(false);
      lastActivity.current = Date.now();
    };

    window.addEventListener("offline", handleOfflineLogout);
    window.addEventListener("online", handleOnline);

    if (!navigator.onLine) {
      void handleSessionExpired();
    }

    return () => {
      window.removeEventListener("offline", handleOfflineLogout);
      window.removeEventListener("online", handleOnline);
    };
  }, [pathname, warningOpen, router]);

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) return;

    const markActivity = () => {
      if (!warningOpen) lastActivity.current = Date.now();
    };
    const activityEvents = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));

    const timer = window.setInterval(() => {
      if (signingOut.current) return;

      const inactiveMs = Date.now() - lastActivity.current;

      if (inactiveMs >= INACTIVITY_TIMEOUT_MS) {
        void handleSessionExpired();
        return;
      }

      const shouldWarn = inactiveMs >= INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS;
      if (shouldWarn) {
        setWarningOpen(true);
        const remainingSeconds = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - inactiveMs) / 1000));
        setCountdown(remainingSeconds);
      }
    }, 1000);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      window.clearInterval(timer);
    };
  }, [pathname, router, warningOpen]);

  useEffect(() => {
    if (!warningOpen) return;

    const interval = window.setInterval(() => {
      const inactiveMs = Date.now() - lastActivity.current;
      if (inactiveMs >= INACTIVITY_TIMEOUT_MS) {
        window.clearInterval(interval);
        void handleSessionExpired();
        return;
      }

      setCountdown(Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - inactiveMs) / 1000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [warningOpen]);

  if (!PUBLIC_PATHS.has(pathname) && !authResolved) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff7fc] text-sm font-semibold text-[#b80049]" role="status" aria-live="polite">
        Loading authentication...
      </main>
    );
  }

  return (
    <>
      {children}

      <AnimatePresence>
        {warningOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 18 }}
              className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 9v3" />
                  <path d="M12 17h.01" />
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-slate-900">Session Expiring</h3>
              <p className="mt-2 text-sm text-slate-600">
                Your session will end soon because of inactivity.
              </p>
              <p className="mt-4 text-base font-semibold text-amber-600">
                Auto logout in {countdown}s
              </p>

              <button
                type="button"
                onClick={handleContinueSession}
                className="mt-6 w-full rounded-xl bg-[#b80049] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#9b003c]"
              >
                OK
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
