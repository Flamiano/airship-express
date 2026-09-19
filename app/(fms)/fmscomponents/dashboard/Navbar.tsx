"use client";

import React from "react";
import { Search, Bell } from "lucide-react";
import ThemeToggle from "@/app/components/ThemeToggle";

interface NavbarProps {
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
}

export function Navbar({ searchTerm = "", onSearchChange, className = "" }: NavbarProps) {
  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between gap-4 h-16 px-6 border-b border-border bg-background/80 backdrop-blur-sm ${className}`}
    >
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search across Financial Core..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-full text-foreground placeholder-foreground/40 outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition"
        />
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          type="button"
          className="p-2 rounded-full text-foreground/60 hover:text-foreground hover:bg-border/40 transition"
          aria-label="Notifications"
        >
          <Bell className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  );
}