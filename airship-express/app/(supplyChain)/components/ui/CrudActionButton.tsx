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
  pink: `bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white border-pink-400/80
    shadow-[2px_2px_5px_rgba(236,72,153,0.35),-2px_-2px_5px_rgba(255,255,255,0.8),inset_0_1px_1px_rgba(255,255,255,0.4)]
    dark:bg-pink-600 dark:hover:bg-pink-700 dark:text-white dark:border-pink-500/80
    dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55),-1px_-1px_3px_rgba(255,255,255,0.05),inset_0_1px_1px_rgba(255,255,255,0.2)]
    focus-visible:ring-pink-500/40 active:scale-95`,
  neutral: `bg-[#f0f3f8] hover:bg-[#e6ebf4] text-slate-700 hover:text-pink-600 border-white/80
    shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)]
    dark:bg-[#1d1e28] dark:hover:bg-[#252633] dark:text-slate-200 dark:hover:text-pink-400 dark:border-[#2a2b38]
    dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55),-1px_-1px_4px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]
    hover:border-pink-300 dark:hover:border-pink-500/50
    focus-visible:ring-pink-500/40 active:scale-95`,
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
