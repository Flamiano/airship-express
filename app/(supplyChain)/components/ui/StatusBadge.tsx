"use client";

import React from "react";

export type BadgeTone =
  | "pink"
  | "purple"
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "neutral"
  | "blue";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  dotColor?: string;
  icon?: string | React.ReactNode;
  children: React.ReactNode;
  interactive?: boolean;
  onClick?: (e: React.MouseEvent<any>) => void;
  disabled?: boolean;
  title?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, { base: string; interactive: string; dot: string }> = {
  pink: {
    base: `bg-[#ffe6f0] text-pink-700 border-pink-300/90
      shadow-[0_1px_3px_rgba(244,63,94,0.12),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff]
      dark:bg-[#341427] dark:text-pink-200 dark:border-[#67224c]
      dark:shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]`,
    interactive: `hover:bg-[#ffd9e8] hover:border-pink-400 dark:hover:bg-[#421932] dark:hover:border-[#832b61]
      active:scale-96 cursor-pointer`,
    dot: `bg-pink-500 dark:bg-pink-400`,
  },
  purple: {
    base: `bg-[#f3e8ff] text-purple-700 border-purple-300/90
      shadow-[0_1px_3px_rgba(168,85,247,0.12),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff]
      dark:bg-[#2e1047] dark:text-purple-200 dark:border-[#581c87]
      dark:shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]`,
    interactive: `hover:bg-[#ead5ff] hover:border-purple-400 dark:hover:bg-[#3c155d] dark:hover:border-[#7324b1]
      active:scale-96 cursor-pointer`,
    dot: `bg-purple-500 dark:bg-purple-400`,
  },
  indigo: {
    base: `bg-[#e0e7ff] text-indigo-700 border-indigo-300/90
      shadow-[0_1px_3px_rgba(99,102,241,0.12),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff]
      dark:bg-[#1e1b4b] dark:text-indigo-200 dark:border-[#3730a3]
      dark:shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]`,
    interactive: `hover:bg-[#d0dbff] hover:border-indigo-400 dark:hover:bg-[#282464] dark:hover:border-[#4338ca]
      active:scale-96 cursor-pointer`,
    dot: `bg-indigo-500 dark:bg-indigo-400`,
  },
  blue: {
    base: `bg-[#e0f2fe] text-sky-700 border-sky-300/90
      shadow-[0_1px_3px_rgba(14,165,233,0.12),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff]
      dark:bg-[#0c2a42] dark:text-sky-200 dark:border-[#124b74]
      dark:shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]`,
    interactive: `hover:bg-[#bae6fd] hover:border-sky-400 dark:hover:bg-[#103756] dark:hover:border-[#18649b]
      active:scale-96 cursor-pointer`,
    dot: `bg-sky-500 dark:bg-sky-400`,
  },
  emerald: {
    base: `bg-[#e6f8ef] text-emerald-800 border-emerald-300/90
      shadow-[0_1px_3px_rgba(16,185,129,0.12),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff]
      dark:bg-[#0f2c1f] dark:text-emerald-200 dark:border-[#1d573c]
      dark:shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]`,
    interactive: `hover:bg-[#d5f3e4] hover:border-emerald-400 dark:hover:bg-[#153a29] dark:hover:border-[#277350]
      active:scale-96 cursor-pointer`,
    dot: `bg-emerald-500 dark:bg-emerald-400`,
  },
  amber: {
    base: `bg-[#fef3c7] text-amber-800 border-amber-300/90
      shadow-[0_1px_3px_rgba(245,158,11,0.12),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff]
      dark:bg-[#332005] dark:text-amber-200 dark:border-[#633e08]
      dark:shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]`,
    interactive: `hover:bg-[#fde68a] hover:border-amber-400 dark:hover:bg-[#452b07] dark:hover:border-[#82520a]
      active:scale-96 cursor-pointer`,
    dot: `bg-amber-500 dark:bg-amber-400`,
  },
  rose: {
    base: `bg-[#ffe8ec] text-rose-700 border-rose-300/90
      shadow-[0_1px_3px_rgba(225,29,72,0.12),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff]
      dark:bg-[#38141b] dark:text-rose-200 dark:border-[#6d202d]
      dark:shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]`,
    interactive: `hover:bg-[#ffdbdf] hover:border-rose-400 dark:hover:bg-[#461922] dark:hover:border-[#8b2738]
      active:scale-96 cursor-pointer`,
    dot: `bg-rose-500 dark:bg-rose-400`,
  },
  neutral: {
    base: `bg-white text-slate-700 border-slate-200
      shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff]
      dark:bg-[#1c1d25] dark:text-slate-200 dark:border-[#353746]
      dark:shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]`,
    interactive: `hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-[#252630] dark:hover:border-[#45475a]
      active:scale-96 cursor-pointer`,
    dot: `bg-slate-400 dark:bg-slate-500`,
  },
};

const SIZE_CLASSES = {
  xs: "px-2 py-0.5 text-[10px] gap-1",
  sm: "px-2.5 py-0.5 text-[11px] gap-1.5",
  md: "px-3 py-1 text-xs gap-1.5",
};

/**
 * StatusBadge: Solid, tactile droplet pill for table statuses, payment indicators, and verification results.
 */
export function StatusBadge({
  tone = "neutral",
  dot = false,
  dotColor,
  icon,
  children,
  interactive = false,
  onClick,
  disabled = false,
  title,
  size = "xs",
  className = "",
  ...props
}: StatusBadgeProps) {
  const toneCfg = TONE_CLASSES[tone] || TONE_CLASSES.neutral;
  const isClickable = interactive || !!onClick;

  const combinedClasses = `
    inline-flex items-center font-semibold rounded-full border select-none
    transition-all duration-150 ease-out
    ${SIZE_CLASSES[size]}
    ${toneCfg.base}
    ${isClickable && !disabled ? toneCfg.interactive : ""}
    ${disabled ? "opacity-60 cursor-not-allowed" : ""}
    ${className}
  `.replace(/\s+/g, " ").trim();

  const content = (
    <>
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor || toneCfg.dot}`}
        />
      )}
      {icon && (
        typeof icon === "string" ? (
          <i className={`${icon} text-[10px] shrink-0`} />
        ) : (
          <span className="shrink-0">{icon}</span>
        )
      )}
      <span className="truncate">{children}</span>
    </>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        title={title}
        className={combinedClasses}
        {...(props as any)}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={combinedClasses}
      title={title}
      {...props}
    >
      {content}
    </span>
  );
}

/**
 * Helpers for resolving tones from status strings.
 */
export function getPOStatusTone(status: string): BadgeTone {
  switch (status) {
    case "Draft":
      return "neutral";
    case "Sent":
      return "indigo";
    case "Confirmed":
      return "purple";
    case "Delivered":
      return "pink";
    case "Cancelled":
      return "rose";
    case "Approved":
      return "emerald";
    case "Pending":
      return "amber";
    default:
      return "neutral";
  }
}
