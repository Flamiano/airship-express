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
  primary: `bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border-pink-400/80
    shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]
    dark:border-pink-500/80 dark:shadow-[0_4px_16px_rgba(236,72,153,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.4)]
    focus-visible:ring-pink-500/40 active:scale-95`,
  pink: `bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border-pink-400/80
    shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]
    dark:border-pink-500/80 dark:shadow-[0_4px_16px_rgba(236,72,153,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.4)]
    focus-visible:ring-pink-500/40 active:scale-95`,
  neutral: `bg-[#f0f3f8] hover:bg-[#e6ebf4] text-slate-800 border-white/80
    shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)]
    dark:bg-[#1d1e28] dark:hover:bg-[#252633] dark:text-slate-100 dark:border-[#2a2b38]
    dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]
    focus-visible:ring-slate-400/40 active:scale-95`,
  secondary: `bg-[#f0f3f8] hover:bg-[#e6ebf4] text-slate-800 border-white/80
    shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)]
    dark:bg-[#1d1e28] dark:hover:bg-[#252633] dark:text-slate-100 dark:border-[#2a2b38]
    dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]
    focus-visible:ring-slate-400/40 active:scale-95`,
  danger: `bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white border-rose-400/80
    shadow-[0_4px_14px_rgba(244,63,94,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]
    dark:border-rose-500/80 dark:shadow-[0_4px_16px_rgba(244,63,94,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.4)]
    focus-visible:ring-rose-500/40 active:scale-95`,
  warning: `bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white border-amber-400/80
    shadow-[0_4px_14px_rgba(245,158,11,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]
    dark:border-amber-500/80 dark:shadow-[0_4px_16px_rgba(245,158,11,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.4)]
    focus-visible:ring-amber-500/40 active:scale-95`,
  success: `bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white border-emerald-400/80
    shadow-[0_4px_14px_rgba(16,185,129,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)]
    dark:border-emerald-500/80 dark:shadow-[0_4px_16px_rgba(16,185,129,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.4)]
    focus-visible:ring-emerald-500/40 active:scale-95`,
  dark: `bg-slate-900 hover:bg-slate-800 text-white border-slate-700
    shadow-[3px_3px_8px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)]
    dark:bg-[#1d1e28] dark:hover:bg-[#252633] dark:text-white dark:border-[#2a2b38]
    dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.06)]
    focus-visible:ring-slate-900/40 active:scale-95`,
  ghost: `bg-transparent hover:bg-[#e8edf5]/80 text-slate-700 border-transparent
    dark:hover:bg-[#20212f]/80 dark:text-slate-200
    focus-visible:ring-slate-400/30 active:scale-95`,
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
