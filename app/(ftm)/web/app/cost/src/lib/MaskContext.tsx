"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type MaskContextValue = {
  showValues: boolean;
  setShowValues: (v: boolean) => void;
  toggle: () => void;
  // per-item visibility: key -> boolean
  setItemVisible: (key: string, v: boolean) => void;
  toggleItem: (key: string) => void;
  isItemVisible: (key: string) => boolean;
};

const MaskContext = createContext<MaskContextValue | undefined>(undefined);

export function MaskProvider({ children }: { children: React.ReactNode }) {
  const [showValues, setShowValues] = useState(false);
  const [perItem, setPerItem] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cost_show_values");
      if (stored !== null) setShowValues(stored === "1");
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cost_show_values", showValues ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }, [showValues]);

  useEffect(() => {
    const handleVisibilityShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setPerItem({});
        setShowValues(true);
      } else if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setPerItem({});
        setShowValues(false);
      }
    };

    window.addEventListener("keydown", handleVisibilityShortcut);
    return () => window.removeEventListener("keydown", handleVisibilityShortcut);
  }, []);

  const toggle = () => setShowValues((s) => !s);

  const setItemVisible = (key: string, v: boolean) =>
    setPerItem((p) => ({ ...p, [key]: v }));

  const toggleItem = (key: string) =>
    setPerItem((p) => ({ ...p, [key]: !p[key] }));

  const isItemVisible = (key: string) => {
    if (key in perItem) return !!perItem[key];
    return showValues;
  };

  return (
    <MaskContext.Provider value={{ showValues, setShowValues, toggle, setItemVisible, toggleItem, isItemVisible }}>
      {children}
    </MaskContext.Provider>
  );
}

export function useMask() {
  const ctx = useContext(MaskContext);
  if (!ctx) throw new Error("useMask must be used within MaskProvider");
  return ctx;
}

export default MaskContext;
