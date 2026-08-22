"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "pink"
  | "neutral"
  | "secondary"
  | "danger"
  | "warning"
  | "success"
  | "dark"
  | "ghost";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon-md" | "icon-lg";

export interface AppButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon | React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconPosition?: "left" | "right";
  iconClassName?: string;
  loading?: boolean;
  pill?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: `bg-[#ffe6f0] hover:bg-[#ffd9e8] text-pink-700 border-pink-300 hover:border-pink-400
    shadow-[0_2px_8px_rgba(244,63,94,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff]
    dark:bg-[#341427] dark:hover:bg-[#421932] dark:text-pink-200 dark:border-[#67224c] dark:hover:border-[#832b61]
    dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
    focus-visible:ring-pink-500/40`,
  pink: `bg-[#ffe6f0] hover:bg-[#ffd9e8] text-pink-700 border-pink-300 hover:border-pink-400
    shadow-[0_2px_8px_rgba(244,63,94,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff]
    dark:bg-[#341427] dark:hover:bg-[#421932] dark:text-pink-200 dark:border-[#67224c] dark:hover:border-[#832b61]
    dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
    focus-visible:ring-pink-500/40`,
  neutral: `bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300
    shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_#ffffff]
    dark:bg-[#1c1d25] dark:hover:bg-[#252630] dark:text-slate-100 dark:border-[#353746] dark:hover:border-[#45475a]
    dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
    focus-visible:ring-slate-400/40`,
  secondary: `bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300
    shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_#ffffff]
    dark:bg-[#1c1d25] dark:hover:bg-[#252630] dark:text-slate-100 dark:border-[#353746] dark:hover:border-[#45475a]
    dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
    focus-visible:ring-slate-400/40`,
  danger: `bg-[#ffe8ec] hover:bg-[#ffdbdf] text-rose-700 border-rose-300 hover:border-rose-400
    shadow-[0_2px_8px_rgba(225,29,72,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff]
    dark:bg-[#38141b] dark:hover:bg-[#461922] dark:text-rose-200 dark:border-[#6d202d] dark:hover:border-[#8b2738]
    dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
    focus-visible:ring-rose-500/40`,
  warning: `bg-[#fff8e6] hover:bg-[#ffeed0] text-amber-800 border-amber-300 hover:border-amber-400
    shadow-[0_2px_8px_rgba(245,158,11,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff]
    dark:bg-[#332210] dark:hover:bg-[#422c15] dark:text-amber-200 dark:border-[#664319] dark:hover:border-[#855720]
    dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
    focus-visible:ring-amber-500/40`,
  success: `bg-[#e6f8ef] hover:bg-[#d5f3e4] text-emerald-800 border-emerald-300 hover:border-emerald-400
    shadow-[0_2px_8px_rgba(16,185,129,0.16),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff]
    dark:bg-[#0f2c1f] dark:hover:bg-[#153a29] dark:text-emerald-200 dark:border-[#1d573c] dark:hover:border-[#277350]
    dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
    focus-visible:ring-emerald-500/40`,
  dark: `bg-slate-900 hover:bg-slate-800 text-white border-slate-800 hover:border-slate-700
    shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]
    dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 dark:border-white
    dark:shadow-[0_2px_8px_rgba(255,255,255,0.15)]
    focus-visible:ring-slate-900/40 dark:focus-visible:ring-white/40`,
  ghost: `bg-transparent hover:bg-slate-100/80 text-slate-700 border-transparent hover:border-slate-200
    dark:hover:bg-slate-800/60 dark:text-slate-300 dark:hover:border-slate-700
    focus-visible:ring-slate-400/30`,
};

const SIZE_CLASSES: Record<ButtonSize, { button: string; icon: string }> = {
  xs: {
    button: "h-6 px-2 text-[11px] font-semibold gap-1",
    icon: "w-3 h-3",
  },
  sm: {
    button: "h-7.5 px-3 text-xs font-semibold gap-1.5",
    icon: "w-3.5 h-3.5",
  },
  md: {
    button: "h-9 px-3.5 text-xs sm:text-sm font-semibold gap-2",
    icon: "w-4 h-4",
  },
  lg: {
    button: "h-10 px-4 text-sm font-semibold gap-2",
    icon: "w-4.5 h-4.5",
  },
  "icon-xs": {
    button: "w-6 h-6 p-0",
    icon: "w-3 h-3",
  },
  "icon-sm": {
    button: "w-7.5 h-7.5 p-0",
    icon: "w-3.5 h-3.5",
  },
  "icon-md": {
    button: "w-9 h-9 p-0",
    icon: "w-4 h-4",
  },
  "icon-lg": {
    button: "w-10 h-10 p-0",
    icon: "w-4.5 h-4.5",
  },
};

/**
 * AppButton
 *
 * Tactile solid "water droplet" button for general UI actions (Done, Close, Filter, Create, etc.).
 * - Shows icon with text when text is provided.
 * - Shows icon only when children/text are omitted or when icon-size is selected.
 * - Solid 100% opaque surface with inset top-highlight and elevated drop-shadow.
 */
export const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(
  (
    {
      variant = "neutral",
      size = "sm",
      icon: Icon,
      iconPosition = "left",
      iconClassName = "",
      loading = false,
      pill = true,
      className = "",
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const sizeConfig = SIZE_CLASSES[size];
    const roundedClass = pill ? "rounded-full" : "rounded-xl";

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`inline-flex flex-row items-center justify-center whitespace-nowrap border font-medium cursor-pointer select-none
          transition-all duration-200 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900
          active:scale-96 disabled:opacity-50 disabled:pointer-events-none shrink-0
          ${roundedClass}
          ${sizeConfig.button}
          ${VARIANT_CLASSES[variant]}
          ${className}`}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center justify-center animate-spin shrink-0">
            <svg
              className={sizeConfig.icon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        ) : (
          Icon &&
          iconPosition === "left" && (
            <Icon
              className={`${sizeConfig.icon} shrink-0 ${iconClassName}`}
              strokeWidth={2}
            />
          )
        )}

        {children}

        {!loading && Icon && iconPosition === "right" && (
          <Icon
            className={`${sizeConfig.icon} shrink-0 ${iconClassName}`}
            strokeWidth={2}
          />
        )}
      </button>
    );
  }
);

AppButton.displayName = "AppButton";

export default AppButton;
