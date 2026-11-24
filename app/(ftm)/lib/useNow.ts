"use client";

import { useSyncExternalStore } from "react";

let currentTime = 0;
let intervalId: number | null = null;
const listeners = new Set<() => void>();

function updateTime() {
  const next = Date.now();
  if (next === currentTime) return;
  currentTime = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    currentTime = Date.now();
    intervalId = window.setInterval(updateTime, 60_000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot() {
  return currentTime;
}

function getServerSnapshot() {
  return 0;
}

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
