"use client";

// src/app/spnc/components/usePresenceHeartbeat.ts
// Called inside Sidebar.tsx, so it runs on every app page automatically.
// Pings the server every 20s, but ONLY while the user is really active:
//   - the tab is visible, AND
//   - they moved the mouse / typed / scrolled / clicked within the last 2 minutes.
// Once they go idle, close the tab, or sign out, pings stop and the
// Employees page starts counting "Inactive · Xm".

import { useEffect, useRef } from "react";

const HEARTBEAT_EVERY_MS = 20_000;
const IDLE_AFTER_MS = 2 * 60_000;

export function usePresenceHeartbeat() {
  const lastInputAt = useRef(Date.now());

  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInputAt.current > IDLE_AFTER_MS) return;
      fetch("/spnc/app/api/presence/heartbeat", { method: "POST", keepalive: true }).catch(() => {});
    };

    const markActive = () => {
      const wasIdle = Date.now() - lastInputAt.current > IDLE_AFTER_MS;
      lastInputAt.current = Date.now();
      if (wasIdle) ping(); // back from idle → show as Active right away
    };

    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    document.addEventListener("visibilitychange", ping);

    ping();
    const id = setInterval(ping, HEARTBEAT_EVERY_MS);

    return () => {
      clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
}