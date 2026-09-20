"use client";

/**
 * PerDev-local skeleton primitives.
 *
 * Gray placeholder blocks that visually approximate the eventual content
 * layout. They use ONLY the existing PerDev theme tokens (`bg-line`,
 * `border-line`, `dark:bg-paper/10`) so they render correctly in both light
 * and dark mode with no hard-coded colors. Skeletons exist only while a fetch
 * is in flight and disappear naturally the moment real data renders.
 */

type SkeletonProps = {
  className?: string;
};

/**
 * Base pulsing block. Callers pass the desired shape (rounded-full for pills,
 * rounded-md/lg/xl for blocks) so rounding is always unambiguous.
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-line dark:bg-paper/10 ${className}`}
    />
  );
}

/** Mirrors a `StatTile`: label line + number line on a soft square tile. */
export function SkeletonStatTile({ className = "" }: SkeletonProps) {
  return (
    <div className={`rounded-2xl bg-line px-4 py-5 sm:px-5 ${className}`}>
      <Skeleton className="h-2.5 w-16 max-w-[70%] rounded-full" />
      <Skeleton className="mt-3.5 h-5 w-10 rounded-full" />
    </div>
  );
}

/** A single full-width content card mirroring the Goal/Check-in/Appraisal cards. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-5 py-5 transition-colors dark:border-paper/15">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-4 w-3/5 max-w-[280px] rounded-full" />
          {lines > 2 ? (
            <Skeleton className="h-3 w-4/5 max-w-[420px] rounded-full" />
          ) : null}
          <div className="flex items-center gap-3 pt-1">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 shrink-0 rounded-lg" />
      </div>
    </div>
  );
}

/** Mirrors a `PanelCard`: icon/title header followed by body content lines. */
export function SkeletonPanel({
  lines = 5,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line p-5 dark:border-paper/15 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-32 rounded-full" />
          <Skeleton className="h-2.5 w-24 rounded-full" />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className={
              index === lines - 1 ? "h-3 w-2/3 rounded-full" : "h-3 w-full rounded-full"
            }
          />
        ))}
      </div>
    </section>
  );
}

/** Stacked list of full-width content cards (GoalCard / CheckInCard / AppraisalCard). */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}