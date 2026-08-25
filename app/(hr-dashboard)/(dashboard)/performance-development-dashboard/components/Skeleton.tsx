import type { ReactNode } from "react";

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
