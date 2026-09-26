"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { Variants } from "framer-motion";
import { ArrowRight, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Style tokens (formerly formStyles.ts)                               */
/* ------------------------------------------------------------------ */

const FIELD_BASE =
  "rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-ink transition-colors placeholder:text-muted/70 focus:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:light] dark:border-paper/15 dark:text-paper dark:[color-scheme:dark]";

export const inputClass = FIELD_BASE;

export const selectClass = FIELD_BASE;

export const textareaClass = FIELD_BASE;

export const controlSmallClass =
  "rounded-lg border border-line bg-transparent px-2.5 py-1.5 text-xs text-ink transition-colors focus:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:light] dark:border-paper/15 dark:text-paper dark:[color-scheme:dark]";

export const errorTextClass = "text-xs text-red-600 dark:text-red-400";

export const iconEditClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-paper/15";

export const quietDangerClass =
  "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-600/10 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/15 dark:hover:text-red-300";

export const miniActionClass =
  "inline-flex items-center rounded-md border border-line px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-paper/15 dark:text-paper";

export const listRowClass =
  "rounded-lg border border-line bg-paper dark:border-paper/15 dark:bg-ink";

export const sectionTitleClass =
  "font-bricolage text-lg font-semibold tracking-tight text-ink dark:text-paper";

export const tableWrapClass =
  "w-full overflow-auto rounded-xl border border-line bg-paper dark:border-paper/15 dark:bg-ink";

export const tableClass = "w-full text-sm caption-bottom";

export const thClass =
  "h-11 whitespace-nowrap px-4 text-left align-middle text-xs font-semibold uppercase tracking-[0.08em] text-muted [&:not(:last-child)]:border-b dark:[&:not(:last-child)]:border-paper/15";

export const trClass =
  "border-b border-line transition-colors last:border-0 hover:bg-accent/[0.04] dark:border-paper/15";

export const tdClass = "whitespace-nowrap px-4 py-3 align-middle";

/* ------------------------------------------------------------------ */
/* Motion variants (formerly motion.ts)                                */
/* ------------------------------------------------------------------ */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  shown: {
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

export const staggerItem: Variants = fadeUp;

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

type BadgeProps = {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "neutral";
};

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  const variantStyles = {
    success:
      "bg-green-600/10 text-green-700 border border-green-600/25 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30",
    warning:
      "bg-amber-500/10 text-amber-700 border border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
    danger:
      "bg-red-600/10 text-red-700 border border-red-600/25 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
    neutral:
      "bg-paper text-muted border border-line dark:bg-ink dark:border-paper/15",
  };

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium font-rethink ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  title?: string;
};

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  loading = false,
  className = "",
  title,
}: ButtonProps) {
  const baseStyles =
    "inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold font-rethink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper dark:focus-visible:ring-offset-ink";

  const variantStyles = {
    primary:
      "bg-ink text-paper hover:bg-accent dark:bg-accent dark:text-white dark:hover:bg-accent-dark",
    secondary:
      "border border-line bg-paper text-ink hover:bg-line dark:bg-ink dark:border-paper/15 dark:text-paper dark:hover:bg-paper/10",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      title={title}
      className={`${baseStyles} ${variantStyles[variant]} ${
        isDisabled ? "cursor-not-allowed opacity-50" : ""
      } ${className}`}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-line bg-paper p-6 transition-colors dark:border-paper/15 dark:bg-ink ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StatCard                                                            */
/* ------------------------------------------------------------------ */

type StatCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  href?: string;
};

export function StatCard({ label, value, detail, href }: StatCardProps) {
  const body = (
    <Card
      className={`min-w-[140px] h-full ${
        href
          ? "transition-colors group-hover:border-accent/40 group-focus-visible:border-accent/50"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-bricolage text-2xl font-bold leading-none">
          {value}
        </p>
        {href && (
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-accent opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            View <ArrowRight size={11} strokeWidth={2.25} />
          </span>
        )}
      </div>
      {detail && (
        <p className="mt-1.5 text-xs font-medium text-muted">{detail}</p>
      )}
      <p className="mt-1.5 block truncate text-sm text-muted">{label}</p>
    </Card>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {body}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Chip                                                                */
/* ------------------------------------------------------------------ */

type ChipProps = {
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
};

export function Chip({
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

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

type EmptyStateProps = {
  icon?: (props: { className?: string }) => ReactNode;
  title: string;
  description?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex max-w-md flex-col items-start gap-3 rounded-xl border border-dashed border-line px-6 py-10 font-rethink dark:border-paper/25">
      {Icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div>
        <p className="text-sm font-medium text-ink dark:text-paper">{title}</p>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PageHeader                                                          */
/* ------------------------------------------------------------------ */

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-rethink text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-3 font-bricolage text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-xl text-sm text-muted">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ProgressBar                                                         */
/* ------------------------------------------------------------------ */

type ProgressBarTone = "accent" | "success";

type ProgressBarProps = {
  value: number;
  tone?: ProgressBarTone;
  label?: string;
  className?: string;
};

const TONE_CLASSES: Record<ProgressBarTone, string> = {
  accent: "bg-accent",
  success: "bg-green-600 dark:bg-green-500",
};

export function ProgressBar({
  value,
  tone = "accent",
  label,
  className = "",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-full bg-line dark:bg-paper/15 ${className}`}
    >
      <div
        className={`h-full rounded-full ${TONE_CLASSES[tone]} motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton primitives                                                 */
/* ------------------------------------------------------------------ */

const PULSE =
  "animate-pulse rounded-md bg-line motion-reduce:animate-none dark:bg-paper/15";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`${PULSE} ${className}`} />;
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`${PULSE} h-3 ${
            i === lines - 1 ? "w-2/3" : "w-full"
          }`}
        />
      ))}
    </div>
  );
}

export function SkeletonRegion({
  label = "Loading…",
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="flex flex-wrap gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="min-w-[140px] rounded-xl border border-line bg-paper p-6 dark:border-paper/15 dark:bg-ink"
        >
          <div className={`${PULSE} mb-2 h-8 w-12`} />
          <div className={`${PULSE} h-3 w-20`} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({
  rows = 3,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={`flex flex-col gap-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-line bg-paper p-6 dark:border-paper/15 dark:bg-ink"
        >
          <div className={`${PULSE} mb-3 h-4 w-1/3`} />
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

const MODAL_WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
} as const;

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId?: string;
  size?: keyof typeof MODAL_WIDTHS;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  titleId,
  size = "md",
  children,
  footer,
}: ModalProps) {
  const generatedId = useId();
  const resolvedTitleId = titleId ?? generatedId;

  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      panelRef.current?.focus();
    } else {
      prevFocusRef.current?.focus?.();
      prevFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        ref={panelRef}
        tabIndex={-1}
        className={`flex max-h-[90vh] w-full ${MODAL_WIDTHS[size]} flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl outline-none dark:border-paper/15 dark:bg-ink`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2
            id={resolvedTitleId}
            className="font-bricolage text-lg font-semibold"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-muted transition-colors hover:bg-muted/10 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end border-t border-line px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DataTable building blocks                                            */
/* ------------------------------------------------------------------ */

type DataTableProps = {
  columns: string[];
  children: ReactNode;
  className?: string;
};

export function DataTable({ columns, children, className = "" }: DataTableProps) {
  return (
    <div className={`${tableWrapClass} ${className}`}>
      <table className={tableClass}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className={thClass}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

type DataTableRowProps = {
  children: ReactNode;
};

export function DataTableRow({ children }: DataTableRowProps) {
  return <tr className={trClass}>{children}</tr>;
}

export function TableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`${tdClass} ${className}`}>{children}</td>;
}

export type TableAction = {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  danger?: boolean;
};

export function TableActions({ actions }: { actions: TableAction[] }) {
  if (!actions.length) {
    return <span className="inline-block text-muted">—</span>;
  }
  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          title={action.label}
          className={action.danger ? quietDangerClass : miniActionClass}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Definition list for details dialogs                                 */
/* ------------------------------------------------------------------ */

type DetailRowProps = {
  label: string;
  value: ReactNode;
};

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0 dark:border-paper/15">
      <dt className="shrink-0 text-sm font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink dark:text-paper">
        {value}
      </dd>
    </div>
  );
}
