import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared Customer Portal UI primitives.
 *
 * These are layout wrappers only — no data, no behaviour. Every class comes
 * from the existing Airship Express theme tokens (background, foreground,
 * line, muted, accent) so the portal stays visually identical to the staff
 * side. No gradients, no shadows beyond a border, no oversized type.
 */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-bricolage text-xl font-semibold text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Bordered panel. The portal's only container style. */
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-background ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            {title && (
              <h2 className="text-sm font-medium text-foreground">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Primary action button, matching the portal's existing primary colour. */
export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors"
    >
      {children}
    </Link>
  );
}

/** Secondary action button (ghost style). */
export function SecondaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-foreground bg-background border border-line rounded-lg hover:bg-line/50 transition-colors"
    >
      {children}
    </Link>
  );
}

/** Simple empty state. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-muted mb-3">{icon}</div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Input field matching portal style. */
export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50 placeholder:text-foreground/30 ${className}`}
      {...props}
    />
  );
}

/** Textarea matching portal style. */
export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50 placeholder:text-foreground/30 resize-none ${className}`}
      {...props}
    />
  );
}

/** Select dropdown matching portal style. */
export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

/** Option for Select. */
export function SelectOption({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return <option value={value}>{children}</option>;
}

/** Primary button (not a link) for forms. */
export function PrimaryButton({
  className = "",
  type = "button",
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  className = "",
  type = "button",
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-foreground bg-background border border-line rounded-lg hover:bg-line/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  size = 32,
}: {
  name: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-full bg-foreground/8 border border-foreground/10 flex items-center justify-center font-semibold text-foreground shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials(name)}
    </div>
  );
}

const PILL_TONES = {
  neutral: "bg-line/60 text-muted",
  info: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  danger: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
} as const;

function toneFor(status: string): keyof typeof PILL_TONES {
  const s = status.toLowerCase().replace(/[\s-]+/g, "_");
  if (["completed", "delivered", "resolved", "approved", "confirmed"].includes(s)) return "success";
  if (["pending", "in_progress", "processing", "scheduled", "in_transit"].includes(s)) return "warning";
  if (["new", "submitted", "open", "assigned"].includes(s)) return "info";
  if (["cancelled", "canceled", "rejected", "failed", "declined"].includes(s)) return "danger";
  return "neutral";
}

export function StatusPill({
  status,
  label,
  className = "",
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const text = label ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PILL_TONES[toneFor(status)]} ${className}`}
    >
      {text}
    </span>
  );
}

export function Caption({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`text-xs text-muted ${className}`}>{children}</p>;
}

export function DataRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-right text-foreground">{value}</dd>
    </div>
  );
}