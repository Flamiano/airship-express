"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApi } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi";

interface OtpSessionState {
  active: boolean;
  scope: string | null;
  secondsLeft: number;
}

export function useOtpSession() {
  const { fetchData: fetchSession, deleteData: clearRemoteSession } = useApi(
    "/payroll-benefits-dashboard/api/otp/session"
  );

  const [session, setSession] = useState<OtpSessionState>({
    active: false,
    scope: null,
    secondsLeft: 0,
  });
  const [isChecking, setIsChecking] = useState(true);

  const startedAtRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await fetchSession();
        if (!mounted) return;
        if (res?.active) {
          const secs = res.seconds_left || 0;
          setSession({
            active: true,
            scope: res.scope || "all",
            secondsLeft: secs,
          });
          startedAtRef.current = Date.now();
          durationRef.current = secs;
        } else {
          setSession({ active: false, scope: null, secondsLeft: 0 });
        }
      } catch {
        if (mounted) {
          setSession({ active: false, scope: null, secondsLeft: 0 });
        }
      } finally {
        if (mounted) setIsChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchSession]);

  useEffect(() => {
    if (!session.active) return;
    const interval = setInterval(() => {
      setSession((s) => {
        if (!s.active) return s;
        const elapsed = startedAtRef.current
          ? Math.floor((Date.now() - startedAtRef.current) / 1000)
          : 0;
        const remaining = Math.max(0, durationRef.current - elapsed);
        if (remaining === 0) {
          return { active: false, scope: null, secondsLeft: 0 };
        }
        if (remaining === s.secondsLeft) return s;
        return { ...s, secondsLeft: remaining };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [session.active]);

  const refresh = useCallback(async () => {
    try {
      const res: any = await fetchSession();
      if (res?.active) {
        const secs = res.seconds_left || 0;
        setSession({
          active: true,
          scope: res.scope || "all",
          secondsLeft: secs,
        });
        startedAtRef.current = Date.now();
        durationRef.current = secs;
      } else {
        setSession({ active: false, scope: null, secondsLeft: 0 });
        startedAtRef.current = null;
        durationRef.current = 0;
      }
    } catch {
      // keep current state
    }
  }, [fetchSession]);

  const unlock = useCallback((scope: string, secondsLeft: number) => {
    startedAtRef.current = Date.now();
    durationRef.current = secondsLeft;
    setSession({
      active: true,
      scope: "all",
      secondsLeft,
    });
  }, []);

  const lock = useCallback(async () => {
    try {
      await clearRemoteSession("");
    } catch {
      // ignore
    }
    startedAtRef.current = null;
    durationRef.current = 0;
    setSession({ active: false, scope: null, secondsLeft: 0 });
  }, [clearRemoteSession]);

  return {
    session,
    isChecking,
    refresh,
    unlock,
    lock,
  };
}
