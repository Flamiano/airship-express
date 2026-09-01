"use client";

import { ReactNode } from "react";
import { Menu, Sun, Moon } from "lucide-react";
import { useShell } from "@/components/ShellContext";

type PageHeaderProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  headerActions?: ReactNode;
  showThemeToggle?: boolean;
};

export default function PageHeader({ icon, title, subtitle, headerActions, showThemeToggle = true }: PageHeaderProps) {
  const { sidebarOpen, setSidebarOpen, theme, toggleTheme } = useShell();
  const isDark = theme === "dark";

  return (
    <div className="mb-8 flex items-center justify-between px-8 pt-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
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
  );
}