"use client";

import React from "react";
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  Archive,
  RotateCcw,
  Download,
  Copy,
  ExternalLink,
  Check,
  X,
  Send,
  LucideIcon,
} from "lucide-react";

export type CrudActionType =
  | "view"
  | "edit"
  | "delete"
  | "create"
  | "add"
  | "archive"
  | "restore"
  | "download"
  | "copy"
  | "open"
  | "approve"
  | "reject"
  | "respond"
  | "custom";

export type CrudActionVariant = "auto" | "pink" | "neutral";

export interface CrudActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  action?: CrudActionType;
  variant?: CrudActionVariant;
  label?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string; strokeWidth?: number }>;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
}

const ACTION_CONFIG: Record<
  Exclude<CrudActionType, "custom">,
  { label: string; icon: LucideIcon }
> = {
  view: { label: "View", icon: Eye },
  edit: { label: "Edit", icon: Pencil },
  delete: { label: "Delete", icon: Trash2 },
  create: { label: "Create", icon: Plus },
  add: { label: "Add", icon: Plus },
  archive: { label: "Archive", icon: Archive },
  restore: { label: "Restore", icon: RotateCcw },
  download: { label: "Download", icon: Download },
  copy: { label: "Copy", icon: Copy },
  open: { label: "Open", icon: ExternalLink },
  approve: { label: "Approve", icon: Check },
  reject: { label: "Reject", icon: X },
  respond: { label: "Respond", icon: Send },
};

const VARIANT_STYLES: Record<"pink" | "neutral", string> = {
  pink: `bg-[#ffe6f0] hover:bg-[#ffd9e8] text-pink-700 border-pink-300 hover:border-pink-400
    shadow-[0_2px_8px_rgba(244,63,94,0.18),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff]
    dark:bg-[#341427] dark:hover:bg-[#421932] dark:text-pink-200 dark:border-[#67224c] dark:hover:border-[#832b61]
    dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
    focus-visible:ring-pink-500/40`,
  neutral: `bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300
    shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff]
    dark:bg-[#1c1d25] dark:hover:bg-[#252630] dark:text-slate-100 dark:border-[#353746] dark:hover:border-[#45475a]
    dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]
    focus-visible:ring-slate-400/40`,
};

/**
 * CrudActionButton
 *
 * A tactile, solid "water droplet" action button.
 * - Solid, opaque surfaces with soft tactile top-highlight (zero transparency).
 * - Fixed layout slot: hovering never shifts sibling buttons or table columns.
 * - Symmetrical 200ms ease-in-out expansion and retraction.
 * - Color: Pink accent exclusively on Delete; clean solid pearl on all other actions.
 */
export const CrudActionButton = React.forwardRef<
  HTMLButtonElement,
  CrudActionButtonProps
>(
  (
    {
      action = "view",
      variant = "auto",
      label: customLabel,
      icon: CustomIcon,
      ariaLabel,
      title,
      className = "",
      size = "sm",
      type = "button",
      disabled,
      onClick,
      ...restProps
    },
    ref
  ) => {
    const config = action !== "custom" ? ACTION_CONFIG[action] : null;
    const label = customLabel || config?.label || "Action";
    const IconComponent = CustomIcon || config?.icon || Eye;
    const accessibleLabel = ariaLabel || title || label;

    // Pink only on delete by default, neutral for all others
    const resolvedVariant: "pink" | "neutral" =
      variant === "auto" ? (action === "delete" ? "pink" : "neutral") : variant;

    const slotDimensions =
      size === "sm" ? "w-7 h-7" : "w-8 h-8";

    const buttonSizeClasses =
      size === "sm"
        ? "h-7 min-w-[28px] px-2 text-xs"
        : "h-8 min-w-[32px] px-2.5 text-xs";

    return (
      <div
        className={`relative inline-flex items-center justify-end shrink-0 z-10 hover:z-50 focus-within:z-50 ${slotDimensions} ${className}`}
      >
        <button
          ref={ref}
          type={type}
          onClick={onClick}
          disabled={disabled}
          aria-label={accessibleLabel}
          title={title || label}
          className={`group/crud-btn absolute right-0 top-0 inline-flex items-center justify-center font-medium rounded-full border
            cursor-pointer select-none z-10 hover:z-50 focus-visible:z-50
            transition-all duration-200 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900
            active:scale-96 disabled:opacity-50 disabled:pointer-events-none
            ${buttonSizeClasses}
            ${VARIANT_STYLES[resolvedVariant]}`}
          {...restProps}
        >
          {/* Action Icon: soft fade and collapse on hover, smooth symmetrical restore on hover out */}
          <span
            className="inline-flex items-center justify-center shrink-0 pointer-events-none overflow-hidden
              max-w-[18px] opacity-100 translate-x-0
              group-hover/crud-btn:max-w-0 group-hover/crud-btn:opacity-0 group-hover/crud-btn:-translate-x-1
              group-focus-visible/crud-btn:max-w-0 group-focus-visible/crud-btn:opacity-0 group-focus-visible/crud-btn:-translate-x-1
              transition-all duration-200 ease-in-out"
            aria-hidden="true"
          >
            <IconComponent className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          </span>

          {/* Action Text: soft slide & reveal on hover, smooth symmetrical collapse on hover out */}
          <span
            className="inline-flex items-center font-semibold leading-none whitespace-nowrap overflow-hidden pointer-events-none
              max-w-0 opacity-0 translate-x-1
              group-hover/crud-btn:max-w-[75px] group-hover/crud-btn:opacity-100 group-hover/crud-btn:translate-x-0 group-hover/crud-btn:px-1
              group-focus-visible/crud-btn:max-w-[75px] group-focus-visible/crud-btn:opacity-100 group-focus-visible/crud-btn:translate-x-0 group-focus-visible/crud-btn:px-1
              transition-all duration-200 ease-in-out"
          >
            {label}
          </span>
        </button>
      </div>
    );
  }
);

CrudActionButton.displayName = "CrudActionButton";

export default CrudActionButton;
