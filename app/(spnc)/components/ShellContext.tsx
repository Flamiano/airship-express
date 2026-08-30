"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ShellContextType = {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  mounted: boolean;
};

const ShellContext = createContext<ShellContextType | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  }

  return (
    <ShellContext.Provider value={{ sidebarOpen, setSidebarOpen, theme, toggleTheme, mounted }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside ShellProvider");
  return ctx;
}