"use client";

import { useState, useEffect, ReactNode } from "react";
import { Oswald, IBM_Plex_Mono, Inter } from "next/font/google";
import { Menu, Sun, Moon } from "lucide-react";
import Sidebar from "./Sidebar";

const display = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const monoLabel = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-label" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

type AppShellProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  headerActions?: ReactNode;
  showThemeToggle?: boolean;
  children: (isDark: boolean) => ReactNode;
};

export default function AppShell({
  icon,
  title,
  subtitle,
  headerActions,
  showThemeToggle = true,
  children,
}: AppShellProps) {
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  }

  return (
    <div
      className={`${display.variable} ${monoLabel.variable} ${body.variable} flex min-h-screen ${
        isDark ? "bg-[#0B1220]" : "bg-white"
      }`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Toggle sidebar"
              className={`flex h-10 w-10 items-center justify-center rounded-md border transition ${
                isDark
                  ? "border-[#23303D] bg-[#121B26] text-[#F2F1EC] hover:border-[#F2A23B]/40"
                  : "border-gray-200 bg-gray-50 text-black hover:border-[#F2419B]/60"
              }`}
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-md border ${
                  isDark
                    ? "border-[#F2419B]/40 bg-[#3A1229] text-[#F2419B]"
                    : "border-[#F2419B]/30 bg-[#FCE4F1] text-[#D9297E]"
                }`}
              >
                {icon}
              </div>
              <div>
                <p
                  className={`text-lg font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {title}
                </p>
                <p className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>{subtitle}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {headerActions}
            {showThemeToggle && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={`flex h-10 w-10 items-center justify-center rounded-md border transition ${
                  isDark
                    ? "border-[#23303D] bg-[#121B26] text-[#F2A23B] hover:border-[#F2A23B]/40"
                    : "border-gray-200 bg-gray-50 text-black hover:border-[#F2419B]/60"
                }`}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}
          </div>
        </div>

        {children(isDark)}
      </main>
    </div>
  );
}