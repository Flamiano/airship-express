"use client";

/**
 * Shared PerDev presentation primitives (Phase 3A design foundation).
 *
 * Presentation ONLY: no data fetching, no business logic, no authorization.
 * Every primitive encodes the exact visual conventions already repeated
 * across the PerDev pages (page headers, buttons, tabs, banners, cards,
 * badges, progress, empty states, form controls, dialog panels) so future
 * page work migrates mechanically instead of re-inventing markup.
 *
 * Visual system: existing Airship black / white / pink identity. Pink stays
 * an accent (active navigation, primary buttons, selected tabs, progress
 * fills); surfaces stay white/light-neutral with subtle gray borders and
 * dark-mode parity through the existing `perdev-scope` tokens. No new color
 * system, no logo changes, no navigation changes.
 *
 * Nothing here is wired into pages yet — adopting these primitives happens
 * in the page-redesign phases, one page at a time.
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

type PerformancePageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

/**
 * Standard page heading block: Bricolage title, muted context line, and an
 * optional right-aligned action group (Refresh + primary action). Mirrors the
 * header rendered identically by every PerDev management view.
 */
export function PerformancePageHeader({
  title,
  description,
  actions,
}: PerformancePageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight text-ink sm:text-[32px] xl:text-[36px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type PerformanceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

const PERFORMANCE_BUTTON_BASE =
  "inline-flex items-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const PERFORMANCE_BUTTON_VARIANTS: Record<
  NonNullable<PerformanceButtonProps["variant"]>,
  string
> = {
  primary: "bg-accent px-4 text-paper hover:bg-accent-dark",
  ghost:
    "border border-line px-3 text-muted hover:text-ink dark:border-paper/15",
};

/**
 * Standard PerDev button. `primary` is the pink accent action;
 * `ghost` is the bordered secondary action (e.g. Refresh). Additional
 * `className` is appended, never replaces the variant.
 */
export function PerformanceButton({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: PerformanceButtonProps) {
  return (
    <button
      type={type}
      className={`${PERFORMANCE_BUTTON_BASE} ${PERFORMANCE_BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export type PerformanceTab<T extends string> = {
  key: T;
  label: string;
  /**
   * Optional numeric count rendered as a distinct pill after the label.
   * Rendered for every value including zero — never hidden. Omit the field
   * entirely for tabs without a count.
   */
  count?: number | null;
};

type PerformanceTabsProps<T extends string> = {
  tabs: PerformanceTab<T>[];
  active: T;
  onChange: (key: T) => void;
  ariaLabel: string;
};

/**
 * Segmented tab control with pink selected state. Controlled — the caller
 * owns `active` state. Rendered with tablist semantics for assistive tech.
 *
 * Keyboard: Left/Right (and Up/Down) move between tabs and activate the
 * focused tab; Home/End jump to the first/last tab. Roving tabindex keeps a
 * single Tab stop. Mouse, touch, Enter, and Space behavior is unchanged.
 */
export function PerformanceTabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: PerformanceTabsProps<T>) {
  const idSlug = ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const tabId = (key: string) => `perdev-tab-${idSlug}-${key}`;
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1 dark:border-paper/10"
      onKeyDown={(event) => {
        const currentIndex = tabs.findIndex((tab) => tab.key === active);
        let nextIndex: number | null = null;
        if (
          event.key === "ArrowRight" ||
          event.key === "ArrowDown"
        ) {
          nextIndex = (currentIndex + 1) % tabs.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = tabs.length - 1;
        }
        if (nextIndex === null || tabs.length === 0) return;
        const next = tabs[nextIndex];
        if (!next || next.key === active) return;
        event.preventDefault();
        onChange(next.key);
        // Focus follows activation so subsequent arrows keep working from
        // the newly selected tab.
        requestAnimationFrame(() => {
          document.getElementById(tabId(next.key))?.focus();
        });
      }}
    >
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <button
            key={tab.key}
            id={tabId(tab.key)}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              selected
                ? "bg-accent text-paper shadow-sm shadow-accent/25"
                : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                  selected
                    ? "bg-paper text-accent"
                    : "bg-ink/[0.07] text-ink dark:bg-paper/[0.12] dark:text-paper"
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error banner                                                        */
/* ------------------------------------------------------------------ */

type PerformanceErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/**
 * Inline fetch-failure banner with an optional retry action. For page-level
 * load errors, not form validation messages.
 */
export function PerformanceErrorBanner({
  message,
  onRetry,
  retryLabel = "Try again",
}: PerformanceErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4"
    >
      <p className="text-[13px] font-medium text-red-600">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-[12.5px] font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel (card) + section header                                       */
/* ------------------------------------------------------------------ */

type PerformancePanelProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Standard content card shell (Goal / Check-in / Appraisal card shape).
 * Layout inside the panel stays the caller's responsibility.
 */
export function PerformancePanel({
  children,
  className = "",
}: PerformancePanelProps) {
  return (
    <div
      className={`rounded-2xl border border-line bg-paper px-5 py-5 dark:border-paper/10 sm:px-6 ${className}`}
    >
      {children}
    </div>
  );
}

type PerformanceSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

/**
 * Small section heading row used inside pages and panels: optional eyebrow,
 * title, supporting line, and an optional trailing action.
 */
export function PerformanceSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: PerformanceSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 font-bricolage text-[18px] font-medium tracking-tight text-ink">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status badge + progress                                             */
/* ------------------------------------------------------------------ */

type PerformanceStatusBadgeProps = {
  tone?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Pill badge. `tone` carries the caller's status-tone classes (e.g. the
 * `*_TONES` maps in types); defaults to the neutral tone.
 */
export function PerformanceStatusBadge({
  tone = "bg-line text-muted",
  children,
  className = "",
}: PerformanceStatusBadgeProps) {
  return (
    <span
      className={`${tone} rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

type PerformanceProgressProps = {
  value: number;
  label?: string;
};

/**
 * Accessible progress bar with pink fill. `value` is clamped to 0..100 and
 * is presentation-only — never an official performance rating.
 */
export function PerformanceProgress({ value, label }: PerformanceProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

type PerformanceEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
};

/**
 * Rich empty state: optional icon, title, supporting message, and an
 * optional primary action (e.g. "Add your first check-in").
 */
export function PerformanceEmptyState({
  icon,
  title,
  message,
  action,
}: PerformanceEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
      {icon}
      <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
        {title}
      </p>
      <p className="-mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
        {message}
      </p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

type PerformanceFieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
};

/**
 * Labeled form-field wrapper: label row (with optional marker), control
 * slot, hint line, and validation error line.
 */
export function PerformanceField({
  label,
  htmlFor,
  hint,
  error,
  optional = false,
  children,
}: PerformanceFieldProps) {
  const errorId = error ? `${htmlFor}-error` : undefined;
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-[12.5px] font-medium text-ink"
      >
        {label}
        {optional ? (
          <span className="ml-1.5 font-normal text-muted">(optional)</span>
        ) : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error ? (
        <p id={hintId} className="mt-1.5 text-[12px] leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[12px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const PERFORMANCE_INPUT_CLASS =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15";

type PerformanceTextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
};

/**
 * Standard single-line input. Accepts all native input props (type, value,
 * onChange, placeholder, disabled, aria-describedby, ...).
 */
export function PerformanceTextInput({
  id,
  className = "",
  ...rest
}: PerformanceTextInputProps) {
  return (
    <input
      id={id}
      className={`${PERFORMANCE_INPUT_CLASS} ${className}`}
      {...rest}
    />
  );
}

type PerformanceTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
};

/** Standard multi-line input with vertical resize. */
export function PerformanceTextarea({
  id,
  className = "",
  ...rest
}: PerformanceTextareaProps) {
  return (
    <textarea
      id={id}
      className={`${PERFORMANCE_INPUT_CLASS} resize-none ${className}`}
      {...rest}
    />
  );
}

type PerformanceSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
};

/** Standard native select. */
export function PerformanceSelect({
  id,
  className = "",
  ...rest
}: PerformanceSelectProps) {
  return (
    <select
      id={id}
      className={`${PERFORMANCE_INPUT_CLASS} ${className}`}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Dialog panel                                                        */
/* ------------------------------------------------------------------ */

type PerformanceDialogPanelProps = {
  size?: "sm" | "md" | "lg";
  labelledBy?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Modal panel shell rendered inside the shared `Modal` focus-trap layer.
 * Matches every existing PerDev dialog's positioning, border, and padding;
 * `size` selects the established max widths.
 */
export function PerformanceDialogPanel({
  size = "md",
  labelledBy,
  children,
  className = "",
}: PerformanceDialogPanelProps) {
  return (
    <div
      role="document"
      aria-labelledby={labelledBy}
      className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15 ${
        size === "lg" ? "max-w-3xl" : size === "sm" ? "max-w-xl" : "max-w-2xl"
      } ${className}`}
    >
      {children}
    </div>
  );
}
