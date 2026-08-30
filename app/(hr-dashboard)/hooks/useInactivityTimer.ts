"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "../supabase/client";

interface UseInactivityTimerOptions {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onWarning?: () => void;
  onLogout?: () => void;
  enabled?: boolean;
}

export function useInactivityTimer({
  timeoutMinutes = 5,
  warningMinutes = 0.5,
  onWarning,
  onLogout,
  enabled = true,
}: UseInactivityTimerOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isMounted = useRef(true);
  const isPaused = useRef(false);

  const logout = useCallback(async () => {
    if (!isMounted.current) return;

    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
        warningRef.current = null;
      }

      await supabase.auth.signOut();

      if (onLogout) {
        onLogout();
      }

      router.push("/hrAuth");
      router.refresh();
    } catch (error) {
      console.error("Error during auto-logout:", error);
    }
  }, [router, supabase, onLogout]);

  const resetTimer = useCallback(() => {
    if (!enabled || !isMounted.current || isPaused.current) return;

    lastActivityRef.current = Date.now();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }

    const warningDelay = (timeoutMinutes - warningMinutes) * 60 * 1000;
    if (warningDelay > 0 && onWarning) {
      warningRef.current = setTimeout(() => {
        if (isMounted.current && !isPaused.current) {
          onWarning();
        }
      }, warningDelay);
    }

    const timeoutDelay = timeoutMinutes * 60 * 1000;
    timeoutRef.current = setTimeout(() => {
      if (isMounted.current && !isPaused.current) {
        logout();
      }
    }, timeoutDelay);
  }, [enabled, timeoutMinutes, warningMinutes, onWarning, logout]);

  const pauseTimer = useCallback(() => {
    isPaused.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const resumeTimer = useCallback(() => {
    isPaused.current = false;
    resetTimer();
  }, [resetTimer]);

  const reset = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Reset timer on user activity
  useEffect(() => {
    if (!enabled) return;

    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "wheel",
      "resize",
      "focus",
      "focusin",
    ];

    const handleActivity = () => {
      if (!isPaused.current) {
        resetTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, {
        capture: true,
        passive: true,
      });
    });

    const handleRouteChange = () => {
      resetTimer();
    };

    window.addEventListener("popstate", handleRouteChange);

    resetTimer();

    return () => {
      isMounted.current = false;
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity, { capture: true });
      });
      window.removeEventListener("popstate", handleRouteChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
        warningRef.current = null;
      }
    };
  }, [enabled, resetTimer]);

  useEffect(() => {
    if (!enabled || !pathname) return;
    resetTimer();
  }, [pathname, enabled, resetTimer]);

  return {
    resetTimer: reset,
    pauseTimer,
    resumeTimer,
    logout,
  };
}
