"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../supabase/client";
import {
  SESSION_START_KEY,
  SESSION_ABSOLUTE_MS,
  SESSION_INACTIVITY_MINUTES,
  SESSION_WARNING_SECONDS,
} from "../constants/session";

interface UseInactivityTimerOptions {
  timeoutMinutes?: number;
  warningSeconds?: number;
  onWarning?: () => void;
  onLogout?: (reason: "inactivity" | "absolute" | "manual") => void;
  enabled?: boolean;
}

export function useInactivityTimer({
  timeoutMinutes = SESSION_INACTIVITY_MINUTES,
  warningSeconds = SESSION_WARNING_SECONDS,
  onWarning,
  onLogout,
  enabled = true,
}: UseInactivityTimerOptions = {}) {
  const router = useRouter();
  const supabase = createClient();

  const inactivityRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const absoluteRef = useRef<NodeJS.Timeout | null>(null);

  const isMounted = useRef(true);
  const isPaused = useRef(false);
  const loggingOut = useRef(false);
  const hasWarned = useRef(false);

  const onWarningRef = useRef(onWarning);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  const performLogout = useCallback(
    async (reason: "inactivity" | "absolute" | "manual") => {
      if (!isMounted.current || loggingOut.current) return;
      loggingOut.current = true;

      try {
        if (inactivityRef.current) clearTimeout(inactivityRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);
        if (absoluteRef.current) clearTimeout(absoluteRef.current);

        await supabase.auth.signOut();
        localStorage.removeItem(SESSION_START_KEY);

        onLogoutRef.current?.(reason);
        router.push("/hrAuth");
        router.refresh();
      } catch (err) {
        console.error("Logout error:", err);
      }
    },
    [router, supabase]
  );

  const resetTimer = useCallback(() => {
    if (!enabled || !isMounted.current || isPaused.current) return;

    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    hasWarned.current = false;

    const warningDelay = (timeoutMinutes * 60 - warningSeconds) * 1000;
    const logoutDelay = timeoutMinutes * 60 * 1000;

    if (warningDelay > 0 && onWarningRef.current) {
      warningRef.current = setTimeout(() => {
        if (isMounted.current && !isPaused.current && !hasWarned.current) {
          hasWarned.current = true;
          onWarningRef.current?.();
        }
      }, warningDelay);
    }

    inactivityRef.current = setTimeout(() => {
      if (isMounted.current && !isPaused.current) {
        performLogout("inactivity");
      }
    }, logoutDelay);
  }, [enabled, timeoutMinutes, warningSeconds, performLogout]);

  const pauseTimer = useCallback(() => {
    isPaused.current = true;
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const resumeTimer = useCallback(() => {
    isPaused.current = false;
    resetTimer();
  }, [resetTimer]);

  const reset = useCallback(() => resetTimer(), [resetTimer]);

  useEffect(() => {
    if (!enabled) return;

    let start = Number(localStorage.getItem(SESSION_START_KEY));
    if (!start || Number.isNaN(start)) {
      start = Date.now();
      localStorage.setItem(SESSION_START_KEY, start.toString());
    }

    const elapsed = Date.now() - start;
    const remaining = SESSION_ABSOLUTE_MS - elapsed;

    if (remaining <= 0) {
      performLogout("absolute");
      return;
    }

    absoluteRef.current = setTimeout(() => {
      performLogout("absolute");
    }, remaining);

    return () => {
      if (absoluteRef.current) clearTimeout(absoluteRef.current);
    };
  }, [enabled, performLogout]);

  useEffect(() => {
    if (!enabled) return;

    const events = [
      "mousedown",
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
      if (!isPaused.current) resetTimer();
    };

    events.forEach((e) =>
      window.addEventListener(e, handleActivity, {
        capture: true,
        passive: true,
      })
    );

    resetTimer();

    return () => {
      isMounted.current = false;
      events.forEach((e) =>
        window.removeEventListener(e, handleActivity, { capture: true })
      );
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [enabled, resetTimer]);

  return {
    resetTimer: reset,
    pauseTimer,
    resumeTimer,
    logout: () => performLogout("manual"),
    performForcedLogout: performLogout,
  };
}
