"use client";

import { useId, type ReactNode } from "react";

/**
 * PerDev-local tooltip for icon-only controls.
 *
 * Pure-CSS reveal via `group-hover` / `group-has-[:focus-visible]`, so the
 * tooltip never intercepts pointer events, does not interfere with dialogs,
 * dropdowns, or destructive-action confirmations, and stays fully keyboard
 * accessible: hovering the control OR keyboard-focusing it (Tab) reveals the
 * label.
 *
 * The focus reveal intentionally uses `:focus-visible` rather than
 * `:focus-within`. PerDev dialogs auto-focus their first focusable control,
 * which is typically a Tooltip-wrapped close button; with `:focus-within` that
 * programmatic focus instantly left the tooltip visibly open before the user
 * interacted with it. `:focus-visible` ignores programmatic/pointer focus while
 * still revealing for genuine keyboard (Tab) focus.
 *
 * Uses only existing PerDev theme tokens (`--line`, `--paper`, `--ink`), so it
 * matches light and dark mode with no hard-coded colors. All tooltip triggers
 * in PerDev already carry an `aria-label` for screen readers; this component
 * only adds the visual affordance.
 */
export function Tooltip({
  label,
  side = "top",
  className = "",
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  const tooltipId = useId();
  const sideClasses: Record<string, string> = {
    top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
    left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
    right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
  };

  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      <span aria-describedby={tooltipId}>{children}</span>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute z-[60] whitespace-nowrap rounded-md border border-line bg-paper px-2 py-1 text-[11px] font-medium text-ink opacity-0 transition-opacity duration-150 group-hover/tooltip:opacity-100 group-has-[:focus-visible]/tooltip:opacity-100 dark:border-paper/15 ${sideClasses[side]}`}
      >
        {label}
      </span>
    </span>
  );
}