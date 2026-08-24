"use client";

import type { ReactNode } from "react";

type ChipProps = {
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
};

export default function Chip({
  active = false,
  onClick,
  disabled = false,
  children,
  className = "",
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-ink ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-line bg-paper text-muted hover:border-accent/40 hover:text-ink dark:bg-ink dark:text-muted dark:hover:text-paper"
      } ${className}`}
    >
      {children}
    </button>
  );
}
