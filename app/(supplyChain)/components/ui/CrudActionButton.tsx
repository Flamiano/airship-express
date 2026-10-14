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
  Ban,
  Loader2,
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
  | "message"
  | "account"
  | "lock"
  | "unlock"
  | "block"
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
  badgeCount?: number;
  loading?: boolean;
  isLoading?: boolean;
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
  message: { label: "Message", icon: Send },
  account: { label: "Account", icon: Plus },
  lock: { label: "Disable", icon: X },
  unlock: { label: "Enable", icon: Check },
  block: { label: "Block", icon: Ban },
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
 * - Color: Pink accent on Delete & Block; clean solid pearl on all other actions.
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
      badgeCount,
      loading,
      isLoading,
      onClick,
      ...restProps
    },
    ref
  ) => {
    const isBusy = Boolean(loading || isLoading);
    const config = action !== "custom" ? ACTION_CONFIG[action] : null;
    const label = isBusy ? "Loading..." : customLabel || config?.label || "Action";
    const IconComponent = CustomIcon || config?.icon || Eye;
    const accessibleLabel = ariaLabel || title || label;

    // Pink on delete or block by default, neutral for all others
    const resolvedVariant: "pink" | "neutral" =
      variant === "auto"
        ? action === "delete" || action === "block"
          ? "pink"
          : "neutral"
        : variant;

    const slotDimensions =
      size === "sm" ? "w-7 h-7" : "w-8 h-8";

    const buttonSizeClasses =
      size === "sm"
        ? "h-7 min-w-[28px] px-2 text-xs"
        : "h-8 min-w-[32px] px-2.5 text-xs";

    return (
      <div
        className={`relative inline-flex items-center justify-end shrink-0 z-10 hover:z-50 focus-within:z-50 ${slotDimensions} max-sm:w-auto max-sm:h-auto ${className}`}
      >
        <button
          ref={ref}
          type={type}
          onClick={onClick}
          disabled={disabled || isBusy}
          aria-busy={isBusy}
          aria-label={accessibleLabel}
          title={title || label}
          className={`group/crud-btn absolute right-0 top-0 max-sm:relative max-sm:right-auto max-sm:top-auto inline-flex items-center justify-center font-medium rounded-full border
            cursor-pointer select-none z-10 hover:z-50 focus-visible:z-50
            transition-all duration-200 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900
            active:scale-96 disabled:opacity-50 disabled:pointer-events-none
            ${buttonSizeClasses} max-sm:w-auto max-sm:px-2.5 max-sm:py-1 max-sm:gap-1.5
            ${VARIANT_STYLES[resolvedVariant]}`}
          {...restProps}
        >
          {/* Action Icon or Loading Spinner */}
          <span
            className={`inline-flex items-center justify-center shrink-0 pointer-events-none overflow-hidden
              max-w-[18px] opacity-100 translate-x-0
              ${!isBusy ? 'sm:group-hover/crud-btn:max-w-0 sm:group-hover/crud-btn:opacity-0 sm:group-hover/crud-btn:-translate-x-1 sm:group-focus-visible/crud-btn:max-w-0 sm:group-focus-visible/crud-btn:opacity-0 sm:group-focus-visible/crud-btn:-translate-x-1' : ''}
              transition-all duration-200 ease-in-out`}
            aria-hidden="true"
          >
            {isBusy ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-current" strokeWidth={2.5} />
            ) : (
              <IconComponent className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
            )}
          </span>

          {/* Action Text: soft slide & reveal on hover on desktop, always visible on mobile/lower screens where hover does not exist */}
          {!isBusy && (
            <span
              className="inline-flex items-center font-semibold leading-none whitespace-nowrap overflow-hidden pointer-events-none
                max-sm:max-w-[100px] max-sm:opacity-100 max-sm:translate-x-0 max-sm:px-0.5
                sm:max-w-0 sm:opacity-0 sm:translate-x-1
                sm:group-hover/crud-btn:max-w-[75px] sm:group-hover/crud-btn:opacity-100 sm:group-hover/crud-btn:translate-x-0 sm:group-hover/crud-btn:px-1
                sm:group-focus-visible/crud-btn:max-w-[75px] sm:group-focus-visible/crud-btn:opacity-100 sm:group-focus-visible/crud-btn:translate-x-0 sm:group-focus-visible/crud-btn:px-1
                transition-all duration-200 ease-in-out text-[11px]"
            >
              {label}
            </span>
          )}
        </button>

        {/* Unread / Notification Count Badge */}
        {!isBusy && badgeCount !== undefined && badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-pink-600 text-white font-black text-[9px] shadow-sm border border-white dark:border-[#191a24] pointer-events-none z-30 animate-pulse">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </div>
    );
  }
);

CrudActionButton.displayName = "CrudActionButton";

export default CrudActionButton;

