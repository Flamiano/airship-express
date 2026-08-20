
import React, { ReactNode } from 'react';

export function SkeletonBlock({
    className = '',
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            {...props}
            className={`bg-slate-200 rounded animate-pulse ${className}`}
        />
    );
}

export function StatsSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-sm space-y-3"
                >
                    <div className="flex items-center justify-between">
                        <SkeletonBlock className="h-4 w-24 bg-slate-200 dark:bg-slate-800" />
                        <SkeletonBlock className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-800" />
                    </div>
                    <SkeletonBlock className="h-8 w-20 bg-slate-200 dark:bg-slate-800" />
                    <SkeletonBlock className="h-3 w-32 bg-slate-200/80 dark:bg-slate-800/60" />
                </div>
            ))}
        </div>
    );
}

export function ChartsSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Bar Chart Card Skeleton */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                    <SkeletonBlock className="h-5 w-40" />
                    <SkeletonBlock className="h-8 w-24 rounded-lg" />
                </div>

                <div className="h-[220px] bg-slate-50 dark:bg-slate-950/50 rounded-lg p-4 flex items-end justify-between gap-2 border border-dashed border-slate-200 dark:border-slate-800">
                    {[40, 70, 45, 90, 60, 80, 50, 65, 85, 30].map((h, i) => (
                        <SkeletonBlock
                            key={i}
                            style={{ height: `${h}%` }}
                            className="w-full rounded-t"
                        />
                    ))}
                </div>
            </div>

            {/* Donut Chart / Metric Card Skeleton */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 space-y-4 flex flex-col justify-between">
                <SkeletonBlock className="h-5 w-32" />

                <div className="flex items-center justify-center py-4">
                    <SkeletonBlock className="h-36 w-36 rounded-full border-8 border-slate-100 dark:border-slate-800" />
                </div>

                <div className="space-y-2">
                    <SkeletonBlock className="h-3 w-full" />
                    <SkeletonBlock className="h-3 w-3/4" />
                </div>
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
    const colWidths = ['w-24', 'w-36', 'w-20', 'w-28', 'w-16', 'w-32'];

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
            {/* Header / Filter Toolbar Skeleton */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
                <SkeletonBlock className="h-10 w-full sm:w-64 rounded-lg bg-slate-200/70 dark:bg-slate-800" />
                <div className="flex gap-2">
                    <SkeletonBlock className="h-10 w-28 rounded-lg bg-slate-200/70 dark:bg-slate-800" />
                    <SkeletonBlock className="h-10 w-28 rounded-lg bg-slate-200/70 dark:bg-slate-800" />
                </div>
            </div>

            {/* Table Skeleton */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            {Array.from({ length: cols }).map((_, i) => (
                                <th key={i} className="px-4 py-3">
                                    <SkeletonBlock className="h-4 w-20 bg-slate-200 dark:bg-slate-700/60 rounded" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {Array.from({ length: rows }).map((_, rowIndex) => (
                            <tr key={rowIndex} className="dark:bg-slate-900">
                                {Array.from({ length: cols }).map((_, colIndex) => (
                                    <td key={colIndex} className="px-4 py-3.5">
                                        <SkeletonBlock
                                            className={`h-4 rounded bg-slate-200/60 dark:bg-slate-800 ${colWidths[colIndex % colWidths.length]}`}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function PageSkeleton() {
    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6 space-y-6 transition-colors duration-200">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <SkeletonBlock className="h-8 w-56 rounded-xl bg-slate-200/80 dark:bg-slate-800/60" />
                    <SkeletonBlock className="h-4 w-72 rounded-lg bg-slate-200/60 dark:bg-slate-800/40" />
                </div>
                <SkeletonBlock className="h-10 w-32 rounded-xl bg-slate-200/80 dark:bg-slate-800/60" />
            </div>

            {/* Tab Bar / Nav Skeleton */}
            <div className="flex gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                <SkeletonBlock className="h-9 w-24 rounded-xl bg-slate-200/80 dark:bg-slate-800/60" />
                <SkeletonBlock className="h-9 w-24 rounded-xl bg-slate-200/60 dark:bg-slate-800/40" />
                <SkeletonBlock className="h-9 w-24 rounded-xl bg-slate-200/60 dark:bg-slate-800/40" />
            </div>

            {/* Body Content Skeletons */}
            <StatsSkeleton count={3} />
            <ChartsSkeleton />
            <TableSkeleton rows={5} cols={5} />
        </div>
    );
}

export function WithPageSkeleton({
    loading,
    children,
}: {
    loading: boolean;
    children: ReactNode;
}) {
    if (loading) {
        return <PageSkeleton />;
    }
    return <>{children}</>;
}