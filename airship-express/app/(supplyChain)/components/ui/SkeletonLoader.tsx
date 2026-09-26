import React, { ReactNode } from 'react';

// base skeleton block
export interface SkeletonBlockProps extends React.ComponentProps<'div'> {
    variant?: 'rectangular' | 'rounded' | 'circular' | 'pill' | 'text' | 'badge' | 'button';
    width?: string | number;
    height?: string | number;
}

export function SkeletonBlock({
    className = '',
    variant = 'rounded',
    width,
    height,
    style,
    ...props
}: SkeletonBlockProps) {
    const variantClasses = {
        rectangular: 'rounded-none',
        rounded: 'rounded-lg',
        circular: 'rounded-full',
        pill: 'rounded-full',
        text: 'rounded-md h-3.5',
        badge: 'rounded-full h-5 w-16',
        button: 'rounded-xl h-8 w-20',
    }[variant];

    const inlineStyle: React.CSSProperties = {
        ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
        ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
        ...style,
    };

    return (
        <div
            {...props}
            style={inlineStyle}
            className={`bg-slate-200/80 dark:bg-slate-800/80 animate-pulse ${variantClasses} ${className}`}
        />
    );
}

// shimmer effect variant
export function SkeletonShimmer({
    className = '',
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            {...props}
            className={`relative overflow-hidden bg-slate-200/70 dark:bg-slate-800/70 rounded before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 dark:before:via-white/10 before:to-transparent ${className}`}
        />
    );
}

// cards skeleton
export interface CardsSkeletonProps {
    count?: number;
    cols?: number | string;
    className?: string;
    height?: string;
    variant?: 'kpi' | 'simple' | 'compact';
}

export function CardsSkeleton({
    count = 4,
    cols,
    className = '',
    height = 'h-40',
    variant = 'kpi',
}: CardsSkeletonProps) {
    const defaultGrid = count === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : count === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-2 xl:grid-cols-4';

    const gridClass = cols
        ? (typeof cols === 'number' ? `grid-cols-1 sm:grid-cols-${cols}` : cols)
        : defaultGrid;

    const titleWidths = ['w-24', 'w-28', 'w-20', 'w-26', 'w-22'];
    const valueWidths = ['w-28', 'w-32', 'w-24', 'w-36', 'w-28'];
    const deltaWidths = ['w-20', 'w-24', 'w-16', 'w-22', 'w-18'];

    return (
        <div className={`grid gap-4 ${gridClass} ${className}`}>
            {Array.from({ length: count }).map((_, i) => {
                const titleWidth = titleWidths[i % titleWidths.length];
                const valueWidth = valueWidths[i % valueWidths.length];
                const deltaWidth = deltaWidths[i % deltaWidths.length];

                if (variant === 'simple') {
                    return (
                        <div
                            key={i}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex items-center gap-3 animate-pulse"
                        >
                            <SkeletonBlock className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-950/40 shrink-0" />
                            <div className="space-y-1.5 flex-1">
                                <SkeletonBlock className={`h-3.5 ${titleWidth}`} />
                                <SkeletonBlock className={`h-6 ${valueWidth}`} />
                            </div>
                        </div>
                    );
                }

                if (variant === 'compact') {
                    return (
                        <div
                            key={i}
                            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-xs flex flex-col justify-between animate-pulse h-28"
                        >
                            <div className="flex items-center justify-between">
                                <SkeletonBlock className={`h-3 ${titleWidth}`} />
                                <SkeletonBlock className="w-4 h-4 rounded-full" />
                            </div>
                            <SkeletonBlock className={`h-6 ${valueWidth}`} />
                        </div>
                    );
                }

                // default kpi card
                return (
                    <div
                        key={i}
                        className={`${height} bg-white/95 dark:bg-[#181920]/95 rounded-2xl border border-slate-200/90 dark:border-[#353746] p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-col justify-between animate-pulse`}
                    >
                        <div className="flex items-center gap-2">
                            <SkeletonBlock className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 shrink-0" />
                            <SkeletonBlock className={`h-3.5 ${titleWidth}`} />
                        </div>

                        <div className="my-0.5 space-y-1">
                            <SkeletonBlock className={`h-7 sm:h-8 ${valueWidth} rounded-lg`} />
                        </div>

                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                            <div className="flex items-center gap-1.5">
                                <SkeletonBlock className="w-3.5 h-3.5 rounded-full bg-slate-200/70 dark:bg-slate-800/70 shrink-0" />
                                <SkeletonBlock className={`h-3 ${deltaWidth} bg-slate-200/70 dark:bg-slate-800/70`} />
                            </div>
                            <SkeletonBlock className="w-3.5 h-3.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 shrink-0" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export const StatsSkeleton = CardsSkeleton;

// chart skeleton
export interface ChartSkeletonProps {
    type?: 'bar' | 'double-bar' | 'line' | 'area' | 'doughnut' | 'pie';
    title?: string | boolean;
    subtitle?: string | boolean;
    height?: string;
    itemsCount?: number;
    legend?: Array<{ label?: string; color?: string }> | number | boolean;
    badgeIcon?: string | boolean;
    className?: string;
    footerLabels?: string[] | number | boolean;
}

export function ChartSkeleton({
    type = 'bar',
    title = true,
    subtitle = true,
    height = 'h-60',
    itemsCount = 6,
    legend = true,
    badgeIcon = true,
    className = '',
    footerLabels = true,
}: ChartSkeletonProps) {
    const barHeights = [45, 75, 60, 90, 50, 80, 65, 85, 40, 70, 55, 95];
    const doubleBarHeights = [
        { primary: 80, secondary: 55 },
        { primary: 65, secondary: 40 },
        { primary: 90, secondary: 70 },
        { primary: 50, secondary: 35 },
        { primary: 75, secondary: 60 },
        { primary: 45, secondary: 30 },
    ];
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const doughnutColors = [
        'bg-pink-500/50 dark:bg-pink-500/40',
        'bg-purple-400/50 dark:bg-purple-500/30',
        'bg-indigo-400/50 dark:bg-indigo-500/30',
        'bg-amber-400/40 dark:bg-amber-500/30',
    ];

    const isDoughnutOrPie = type === 'doughnut' || type === 'pie';

    return (
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between animate-pulse ${className}`}>
            {/* header */}
            {(title || subtitle || badgeIcon) && (
                <div className="flex items-center justify-between mb-4">
                    <div className="space-y-1">
                        {typeof title === 'string' ? (
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{title}</h3>
                        ) : title ? (
                            <SkeletonBlock className="h-4 w-48" />
                        ) : null}

                        {typeof subtitle === 'string' ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                        ) : subtitle ? (
                            <SkeletonBlock className="h-3 w-60 bg-slate-200/70 dark:bg-slate-800/70" />
                        ) : null}
                    </div>

                    {badgeIcon && (
                        <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/30 flex items-center justify-center shrink-0">
                            {typeof badgeIcon === 'string' ? (
                                <i className={`${badgeIcon} text-xs text-pink-600 dark:text-pink-400`} />
                            ) : (
                                <SkeletonBlock className="w-4 h-4 rounded bg-pink-400/40 dark:bg-pink-500/30" />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* chart body */}
            {isDoughnutOrPie ? (
                <div className={`${height} flex flex-col sm:flex-row items-center justify-center gap-6 px-2`}>
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-[12px] border-slate-100 dark:border-slate-800 border-t-pink-500/50 dark:border-t-pink-500/40 border-r-purple-400/40 dark:border-r-purple-500/30 border-b-indigo-400/40 dark:border-b-indigo-500/30 flex items-center justify-center shrink-0">
                        {type === 'doughnut' && (
                            <SkeletonBlock className="w-10 h-10 rounded-full bg-slate-100/80 dark:bg-slate-850/60" />
                        )}
                    </div>

                    {legend && (
                        <div className="flex flex-col gap-2.5 w-full sm:w-auto">
                            {Array.isArray(legend) ? (
                                legend.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${item.color || doughnutColors[idx % doughnutColors.length]}`} />
                                        {item.label ? (
                                            <span className="text-xs text-slate-500 dark:text-slate-400">{item.label}</span>
                                        ) : (
                                            <SkeletonBlock className="h-3 w-16 bg-slate-200/70 dark:bg-slate-800/70" />
                                        )}
                                    </div>
                                ))
                            ) : (
                                Array.from({ length: typeof legend === 'number' ? legend : 4 }).map((_, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${doughnutColors[idx % doughnutColors.length]}`} />
                                        <SkeletonBlock className="h-3 w-16 bg-slate-200/70 dark:bg-slate-800/70" />
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className={`${height} bg-slate-50/70 dark:bg-slate-950/40 rounded-xl p-4 flex flex-col justify-between border border-dashed border-slate-200/80 dark:border-slate-800/80`}>
                    {/* legend */}
                    {legend && (
                        <div className="flex items-center justify-center gap-4 pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
                            {Array.isArray(legend) ? (
                                legend.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                        <span className={`w-2.5 h-2.5 rounded ${item.color || 'bg-pink-500/60 dark:bg-pink-500/40'}`} />
                                        {item.label ? (
                                            <span className="text-xs text-slate-500">{item.label}</span>
                                        ) : (
                                            <SkeletonBlock className="h-3 w-12 bg-slate-200/70 dark:bg-slate-800/70" />
                                        )}
                                    </div>
                                ))
                            ) : (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded bg-pink-500/60 dark:bg-pink-500/40" />
                                        <SkeletonBlock className="h-3 w-12 bg-slate-200/70 dark:bg-slate-800/70" />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded bg-pink-300/50 dark:bg-pink-400/30" />
                                        <SkeletonBlock className="h-3 w-14 bg-slate-200/70 dark:bg-slate-800/70" />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* chart area */}
                    <div className="flex-1 flex items-end justify-between sm:justify-around gap-2 pt-3 pb-1">
                        {type === 'double-bar' ? (
                            Array.from({ length: itemsCount }).map((_, idx) => {
                                const h = doubleBarHeights[idx % doubleBarHeights.length];
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end max-w-[48px]">
                                        <div className="w-full flex items-end gap-1 justify-center h-full">
                                            <div
                                                style={{ height: `${h.primary}%` }}
                                                className="w-1/2 bg-pink-500/30 dark:bg-pink-500/20 rounded-t"
                                            />
                                            <div
                                                style={{ height: `${h.secondary}%` }}
                                                className="w-1/2 bg-pink-300/30 dark:bg-pink-400/20 rounded-t"
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        ) : type === 'line' || type === 'area' ? (
                            Array.from({ length: itemsCount }).map((_, idx) => {
                                const h = barHeights[idx % barHeights.length];
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                                        <div className="w-2 h-2 rounded-full bg-pink-500/40 dark:bg-pink-400/30 mb-1" />
                                        <div
                                            style={{ height: `${h}%` }}
                                            className="w-full bg-gradient-to-t from-pink-500/10 via-pink-500/20 to-transparent dark:from-pink-500/5 dark:via-pink-500/15 rounded-t"
                                        />
                                    </div>
                                );
                            })
                        ) : (
                            Array.from({ length: itemsCount }).map((_, idx) => {
                                const h = barHeights[idx % barHeights.length];
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end max-w-[36px]">
                                        <div
                                            style={{ height: `${h}%` }}
                                            className="w-full bg-pink-400/30 dark:bg-pink-500/20 rounded-t"
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* labels */}
                    {footerLabels && (
                        <div className="flex justify-between sm:justify-around items-center pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                            {Array.isArray(footerLabels) ? (
                                footerLabels.map((lbl, idx) => (
                                    <span key={idx} className="text-[10px] font-medium text-slate-300 dark:text-slate-700 select-none">
                                        {lbl}
                                    </span>
                                ))
                            ) : (
                                Array.from({ length: itemsCount }).map((_, idx) => (
                                    <span key={idx} className="text-[10px] font-medium text-slate-300 dark:text-slate-700 select-none">
                                        {monthLabels[idx % monthLabels.length]}
                                    </span>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// charts grid skeleton
export interface ChartsSkeletonProps {
    layout?: 'dual-line-doughnut' | 'dual-bar-doughnut' | 'grid-2' | 'grid-3' | 'single';
    leftChart?: Partial<ChartSkeletonProps>;
    rightChart?: Partial<ChartSkeletonProps>;
    className?: string;
}

export function ChartsSkeleton({
    layout = 'dual-line-doughnut',
    leftChart,
    rightChart,
    className = '',
}: ChartsSkeletonProps) {
    if (layout === 'dual-bar-doughnut') {
        return (
            <div className={`grid grid-cols-1 xl:grid-cols-5 gap-4 ${className}`}>
                <ChartSkeleton
                    type="double-bar"
                    itemsCount={5}
                    className="xl:col-span-3"
                    badgeIcon="fas fa-chart-bar"
                    title="Purchase Activity by Supplier"
                    subtitle="Total orders and paid amount per supplier"
                    {...leftChart}
                />
                <ChartSkeleton
                    type="doughnut"
                    className="xl:col-span-2"
                    badgeIcon="fas fa-chart-pie"
                    title="Supplier Categories"
                    subtitle="Distribution by category"
                    {...rightChart}
                />
            </div>
        );
    }

    if (layout === 'grid-2') {
        return (
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${className}`}>
                <ChartSkeleton type="bar" {...leftChart} />
                <ChartSkeleton type="doughnut" {...rightChart} />
            </div>
        );
    }

    // default dual-line-doughnut
    return (
        <div className={`grid grid-cols-1 xl:grid-cols-3 gap-4 ${className}`}>
            <ChartSkeleton
                type="line"
                itemsCount={12}
                className="xl:col-span-2"
                badgeIcon="fas fa-chart-line"
                title="Spending & Order Frequency"
                subtitle="Annual trend overview"
                {...leftChart}
            />
            <ChartSkeleton
                type="doughnut"
                className="xl:col-span-1"
                badgeIcon="fas fa-chart-pie"
                title="Priority Distribution"
                subtitle="Breakdown by order priority"
                {...rightChart}
            />
        </div>
    );
}

export const SupplierChartsSkeleton = (props: Partial<ChartsSkeletonProps>) => (
    <ChartsSkeleton layout="dual-bar-doughnut" {...props} />
);

// table skeleton
export type TableColumnType = 'text' | 'mono' | 'badge' | 'avatar-text' | 'checkbox' | 'actions' | 'currency' | 'date';

export interface TableColumnDef {
    header?: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    type?: TableColumnType;
    subtext?: boolean;
}

export interface TableSkeletonProps {
    rows?: number;
    cols?: number;
    columns?: Array<TableColumnDef | string> | number;
    hasHeader?: boolean;
    hasFilter?: boolean;
    hasSearch?: boolean;
    hasPagination?: boolean;
    title?: string | boolean;
    actionsCount?: number;
    className?: string;
    tableId?: string;
    cardWrapper?: boolean;
}

export function TableSkeleton({
    rows = 6,
    cols,
    columns,
    hasHeader = true,
    hasFilter = false,
    hasSearch = false,
    hasPagination = true,
    title = true,
    actionsCount = 3,
    className = '',
    tableId,
    cardWrapper = true,
}: TableSkeletonProps) {
    let resolvedCols: TableColumnDef[] = [];

    if (Array.isArray(columns)) {
        resolvedCols = columns.map(c => typeof c === 'string' ? { header: c, type: 'text' } : c);
    } else if (typeof columns === 'number') {
        resolvedCols = Array.from({ length: columns }).map((_, idx) => ({
            type: idx === 0 ? 'checkbox' : idx === columns - 1 ? 'actions' : 'text',
        }));
    } else if (typeof cols === 'number') {
        resolvedCols = Array.from({ length: cols }).map((_, idx) => ({
            type: idx === 0 ? 'checkbox' : idx === cols - 1 ? 'actions' : 'text',
        }));
    } else {
        resolvedCols = [
            { type: 'checkbox', width: 'w-10' },
            { type: 'mono', header: 'ID', width: 'w-24' },
            { type: 'avatar-text', header: 'Name', subtext: true },
            { type: 'text', header: 'Category' },
            { type: 'badge', header: 'Status' },
            { type: 'actions', header: 'Actions', align: 'right', width: 'w-[140px]' },
        ];
    }

    const textWidths = ['w-32', 'w-24', 'w-28', 'w-36', 'w-20'];
    const subtextWidths = ['w-24', 'w-20', 'w-28', 'w-16'];

    const tableContent = (
        <div className="overflow-x-auto">
            <table className="table-pro w-full text-left text-xs border-collapse p-1 animate-pulse" id={tableId}>
                {hasHeader && (
                    <thead className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <tr>
                            {resolvedCols.map((col, cIdx) => (
                                <th
                                    key={cIdx}
                                    className={`py-3.5 px-4 ${col.width || ''} ${col.align === 'right' ? 'text-right!' : col.align === 'center' ? 'text-center' : ''}`}
                                >
                                    {col.type === 'checkbox' ? (
                                        <SkeletonBlock className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700" />
                                    ) : col.header ? (
                                        <span className="opacity-70">{col.header}</span>
                                    ) : (
                                        <SkeletonBlock className={`h-3.5 w-16 bg-slate-200 dark:bg-slate-700 ${col.align === 'right' ? 'ml-auto' : ''}`} />
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {Array.from({ length: rows }).map((_, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            {resolvedCols.map((col, cIdx) => {
                                const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '';
                                const randomTextWidth = textWidths[(rIdx + cIdx) % textWidths.length];
                                const randomSubWidth = subtextWidths[(rIdx + cIdx) % subtextWidths.length];

                                switch (col.type) {
                                    case 'checkbox':
                                        return (
                                            <td key={cIdx} className="py-3 px-4">
                                                <SkeletonBlock className="w-4 h-4 rounded bg-slate-200/70 dark:bg-slate-800/70" />
                                            </td>
                                        );
                                    case 'mono':
                                        return (
                                            <td key={cIdx} className={`py-3 px-4 ${alignClass}`}>
                                                <SkeletonBlock className="h-3.5 w-16 font-mono" />
                                            </td>
                                        );
                                    case 'avatar-text':
                                        return (
                                            <td key={cIdx} className="py-3 px-4 space-y-1">
                                                <SkeletonBlock className={`h-3.5 ${randomTextWidth}`} />
                                                {col.subtext !== false && (
                                                    <SkeletonBlock className={`h-2.5 ${randomSubWidth} bg-slate-200/60 dark:bg-slate-800/60`} />
                                                )}
                                            </td>
                                        );
                                    case 'badge':
                                        return (
                                            <td key={cIdx} className={`py-3 px-4 ${alignClass}`}>
                                                <SkeletonBlock className="h-5 w-16 rounded-full bg-emerald-500/20 dark:bg-emerald-500/10" />
                                            </td>
                                        );
                                    case 'currency':
                                        return (
                                            <td key={cIdx} className={`py-3 px-4 ${alignClass}`}>
                                                <SkeletonBlock className="h-3.5 w-20 ml-auto font-mono" />
                                            </td>
                                        );
                                    case 'date':
                                        return (
                                            <td key={cIdx} className={`py-3 px-4 ${alignClass}`}>
                                                <SkeletonBlock className="h-3.5 w-20 font-mono text-[11px]" />
                                            </td>
                                        );
                                    case 'actions':
                                        return (
                                            <td key={cIdx} className={`py-3 px-4 ${col.width || 'w-[140px]'} text-right`}>
                                                <div className="flex items-center justify-end gap-2.5">
                                                    {Array.from({ length: actionsCount }).map((_, aIdx) => (
                                                        <SkeletonBlock key={aIdx} className="h-6 w-6 rounded-md bg-slate-200/80 dark:bg-slate-800/80" />
                                                    ))}
                                                </div>
                                            </td>
                                        );
                                    case 'text':
                                    default:
                                        return (
                                            <td key={cIdx} className={`py-3 px-4 ${alignClass}`}>
                                                <SkeletonBlock className={`h-3.5 ${randomTextWidth}`} />
                                            </td>
                                        );
                                }
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    if (!cardWrapper) {
        return tableContent;
    }

    return (
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col ${className}`}>
            {/* toolbar */}
            {(hasFilter || hasSearch || typeof title === 'string') && (
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3 animate-pulse">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-pink-500" />
                        {typeof title === 'string' ? (
                            <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">{title}</h2>
                        ) : (
                            <SkeletonBlock className="h-4 w-32" />
                        )}
                    </div>

                    <div className="flex gap-2 items-center ml-auto flex-1 sm:flex-initial justify-end">
                        {hasSearch && (
                            <SkeletonBlock className="h-8 w-44 sm:w-60 rounded-xl" />
                        )}
                        {hasFilter && (
                            <SkeletonBlock className="h-8 w-28 rounded-xl" />
                        )}
                    </div>
                </div>
            )}

            {tableContent}

            {/* pagination */}
            {hasPagination && (
                <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/60 animate-pulse">
                    <SkeletonBlock className="h-4 w-44 bg-slate-200/70 dark:bg-slate-800/70" />
                    <div className="flex items-center gap-1.5">
                        <SkeletonBlock className="h-7 w-16 rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
                        <SkeletonBlock className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800" />
                        <SkeletonBlock className="h-7 w-7 rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
                        <SkeletonBlock className="h-7 w-16 rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
                    </div>
                </div>
            )}
        </div>
    );
}

export const SupplierDirectorySkeleton = ({ rows = 6 }: { rows?: number }) => (
    <TableSkeleton
        rows={rows}
        cardWrapper={false}
        tableId="supplierTableId"
        columns={[
            { type: 'checkbox', width: 'w-10' },
            { header: 'Supplier ID', type: 'mono' },
            { header: 'Supplier Name', type: 'avatar-text', subtext: true },
            { header: 'Category', type: 'text' },
            { header: 'Contact', type: 'avatar-text', subtext: true },
            { header: 'Location', type: 'text' },
            { header: 'Status', type: 'badge' },
            { header: 'Actions', type: 'actions', align: 'right', width: 'w-[150px]' },
        ]}
    />
);

export const PurchaseHistorySkeleton = ({ rows = 5 }: { rows?: number }) => (
    <TableSkeleton
        rows={rows}
        cardWrapper={false}
        tableId="purchaseOrderTableId"
        columns={[
            { type: 'checkbox', width: 'w-10' },
            { header: 'Order #', type: 'mono' },
            { header: 'Supplier', type: 'text' },
            { header: 'Total', type: 'currency' },
            { header: 'Date', type: 'date' },
            { header: 'Status', type: 'badge' },
            { header: 'Payment', type: 'badge' },
            { header: 'Actions', type: 'actions', align: 'right', width: 'w-[125px]' },
        ]}
    />
);

// gallery skeleton
export interface GallerySkeletonProps {
    count?: number;
    className?: string;
}

export function GallerySkeleton({
    count = 8,
    className = '',
}: GallerySkeletonProps) {
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs animate-pulse flex flex-col"
                >
                    <SkeletonBlock className="w-full aspect-4/3 rounded-none bg-slate-200/70 dark:bg-slate-800/70" />
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                            <SkeletonBlock className="h-4 w-3/4" />
                            <div className="flex items-center gap-2">
                                <SkeletonBlock variant="circular" className="w-6 h-6 shrink-0" />
                                <SkeletonBlock className="h-3 w-28" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                            <SkeletonBlock variant="badge" className="w-16 h-5" />
                            <SkeletonBlock className="h-3 w-14" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// table rows skeleton
export interface TableRowsSkeletonProps {
    rows?: number;
    columns?: number | TableColumnDef[];
}

export function TableRowsSkeleton({
    rows = 5,
    columns = 6,
}: TableRowsSkeletonProps) {
    const colDefs: TableColumnDef[] = typeof columns === 'number'
        ? Array.from({ length: columns }).map((_, i) => (
            i === 0 ? { type: 'checkbox' as const, width: 'w-10' }
            : i === columns - 1 ? { type: 'actions' as const, align: 'right' as const, width: 'w-[120px]' }
            : { type: 'text' as const }
        ))
        : columns;

    return (
        <>
            {Array.from({ length: rows }).map((_, rIdx) => (
                <tr key={rIdx} className="border-b border-slate-100 dark:border-slate-800/60 animate-pulse">
                    {colDefs.map((col, cIdx) => {
                        const type = col.type || 'text';
                        const align = col.align || 'left';
                        const width = col.width || '';
                        return (
                            <td key={cIdx} className={`py-3 px-4 ${width} ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}>
                                {type === 'checkbox' ? (
                                    <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700/60 mx-auto" />
                                ) : type === 'avatar-text' ? (
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700/70 shrink-0" />
                                        <div className="space-y-1 flex-1 min-w-0">
                                            <div className="h-3.5 bg-slate-200 dark:bg-slate-700/80 rounded w-28" />
                                            {col.subtext && <div className="h-2.5 bg-slate-200/60 dark:bg-slate-700/50 rounded w-20" />}
                                        </div>
                                    </div>
                                ) : type === 'badge' ? (
                                    <div className={`h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-700/70 ${align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : ''}`} />
                                ) : type === 'actions' ? (
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700/70" />
                                        <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700/70" />
                                    </div>
                                ) : (
                                    <div className={`h-3.5 rounded bg-slate-200 dark:bg-slate-700/80 ${cIdx % 2 === 0 ? 'w-24' : 'w-32'} ${align === 'right' ? 'ml-auto' : align === 'center' ? 'mx-auto' : ''}`} />
                                )}
                            </td>
                        );
                    })}
                </tr>
            ))}
        </>
    );
}

// warehouse specific skeletons
export function WarehouseChartSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-2xl flex flex-col justify-between animate-pulse ${className}`}>
            <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/30 text-indigo-500 flex items-center justify-center">
                            <i className="fas fa-chart-line text-sm opacity-60" />
                        </div>
                        <div className="space-y-1">
                            <SkeletonBlock className="h-4 w-44 bg-slate-200 dark:bg-slate-800" />
                            <SkeletonBlock className="h-3 w-32 bg-slate-200/70 dark:bg-slate-800/60" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <SkeletonBlock variant="badge" className="w-16 h-5 bg-slate-100 dark:bg-slate-800/80" />
                        <SkeletonBlock variant="badge" className="w-12 h-5 bg-indigo-50 dark:bg-indigo-950/30" />
                    </div>
                </div>

                <div className="mt-4 relative min-h-[220px] sm:min-h-[200px] flex flex-col justify-between py-2">
                    <div className="space-y-6">
                        <div className="w-full border-b border-dashed border-slate-100 dark:border-slate-800/80" />
                        <div className="w-full border-b border-dashed border-slate-100 dark:border-slate-800/80" />
                        <div className="w-full border-b border-dashed border-slate-100 dark:border-slate-800/80" />
                        <div className="w-full border-b border-dashed border-slate-100 dark:border-slate-800/80" />
                    </div>

                    <div className="flex items-end justify-between sm:justify-around gap-3 h-32 pt-2 px-2">
                        {[40, 65, 50, 85, 60, 95, 75].map((val, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end max-w-[40px]">
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500/40 dark:bg-indigo-400/30" />
                                <div
                                    style={{ height: `${val}%` }}
                                    className="w-full bg-gradient-to-t from-indigo-500/20 via-indigo-500/30 to-indigo-500/10 dark:from-indigo-500/10 dark:via-indigo-500/20 dark:to-transparent rounded-t-lg"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between sm:justify-around items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                            <span key={idx} className="text-[10px] font-medium text-slate-300 dark:text-slate-600 select-none">
                                {day}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <SkeletonBlock className="w-3.5 h-3.5 rounded-full" />
                    <SkeletonBlock className="h-3 w-48" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                        <div className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-900/60 border-2 border-white dark:border-slate-900" />
                        <div className="w-6 h-6 rounded-full bg-pink-200 dark:bg-pink-900/60 border-2 border-white dark:border-slate-900" />
                        <div className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-900/60 border-2 border-white dark:border-slate-900" />
                    </div>
                    <SkeletonBlock className="h-3 w-16" />
                </div>
            </div>
        </div>
    );
}

export function AiQuestionsSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-2xl flex flex-col justify-between animate-pulse ${className}`}>
            <div>
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-9 h-9 rounded-xl bg-pink-500/20 dark:bg-pink-500/30 text-pink-500 flex items-center justify-center">
                        <i className="fas fa-robot text-sm opacity-60" />
                    </div>
                    <div className="space-y-1">
                        <SkeletonBlock className="h-4 w-36 bg-slate-200 dark:bg-slate-800" />
                        <SkeletonBlock className="h-3 w-24 bg-slate-200/70 dark:bg-slate-800/60" />
                    </div>
                </div>

                <div className="mt-4 space-y-2.5">
                    {[
                        { dot: 'bg-pink-500/50', width: 'w-3/4' },
                        { dot: 'bg-amber-500/50', width: 'w-4/5' },
                        { dot: 'bg-blue-500/50', width: 'w-2/3' },
                        { dot: 'bg-emerald-500/50', width: 'w-5/6' },
                    ].map((q, idx) => (
                        <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 flex items-center gap-3"
                        >
                            <span className={`w-2 h-2 rounded-full ${q.dot} shrink-0`} />
                            <SkeletonBlock className={`h-3.5 ${q.width} bg-slate-200/80 dark:bg-slate-700/60`} />
                            <SkeletonBlock className="w-4 h-4 ml-auto rounded-md bg-slate-200/50 dark:bg-slate-800/50 shrink-0" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <SkeletonBlock className="w-full h-10 rounded-xl bg-pink-100/60 dark:bg-pink-950/30" />
            </div>
        </div>
    );
}

export function ModelForecastingSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-2xl flex flex-col justify-between animate-pulse ${className}`}>
            <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/30 text-indigo-500 flex items-center justify-center">
                            <i className="fas fa-chart-line text-sm opacity-60" />
                        </div>
                        <div className="space-y-1">
                            <SkeletonBlock className="h-4 w-36 bg-slate-200 dark:bg-slate-800" />
                            <SkeletonBlock className="h-3 w-28 bg-slate-200/70 dark:bg-slate-800/60" />
                        </div>
                    </div>
                    <SkeletonBlock variant="badge" className="w-24 h-5 bg-indigo-50 dark:bg-indigo-950/30" />
                </div>

                <div className="mt-4 space-y-3">
                    {[70, 55, 80, 65, 90].map((width, idx) => (
                        <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 space-y-2"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <SkeletonBlock className="h-3.5 w-16 bg-slate-200 dark:bg-slate-700/80" />
                                    <SkeletonBlock className="h-3 w-12 bg-slate-200/60 dark:bg-slate-800/60" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <SkeletonBlock className="h-3.5 w-20 bg-slate-200 dark:bg-slate-700/80" />
                                    <SkeletonBlock variant="badge" className="w-12 h-4.5 bg-slate-200/60 dark:bg-slate-800/60" />
                                </div>
                            </div>
                            <div className="w-full bg-slate-200/70 dark:bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-indigo-400/40 dark:bg-indigo-500/30 h-1.5 rounded-full"
                                    style={{ width: `${width}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <SkeletonBlock className="w-full h-10 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30" />
            </div>
        </div>
    );
}

// full page skeleton
export interface PageSkeletonProps {
    hasHeader?: boolean;
    headerTitle?: string;
    cardsCount?: number;
    chartLayout?: ChartsSkeletonProps['layout'];
    tableRows?: number;
    tableColumns?: TableSkeletonProps['columns'];
    children?: ReactNode;
}

export function PageSkeleton({
    hasHeader = true,
    headerTitle,
    cardsCount = 4,
    chartLayout = 'dual-line-doughnut',
    tableRows = 6,
    tableColumns,
    children,
}: PageSkeletonProps) {
    return (
        <div className="p-6 space-y-6 bgCard min-h-screen transition-colors duration-200">
            {hasHeader && (
                <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-white/10 pb-5 animate-pulse">
                    <div className="flex items-start gap-3.5">
                        <SkeletonBlock className="w-12 h-12 rounded-2xl bg-pink-100 dark:bg-pink-950/40 shrink-0" />
                        <div className="space-y-2">
                            {headerTitle ? (
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{headerTitle}</h1>
                            ) : (
                                <SkeletonBlock className="h-6 sm:h-7 w-56 rounded-xl" />
                            )}
                            <SkeletonBlock className="h-3.5 w-72 rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
                            <SkeletonBlock className="h-5 w-24 rounded-full bg-slate-200/60 dark:bg-slate-800/60 mt-1" />
                        </div>
                    </div>
                    <SkeletonBlock className="h-10 w-44 rounded-xl bg-pink-500/20 dark:bg-pink-600/30" />
                </div>
            )}

            {children ? (
                children
            ) : (
                <>
                    {cardsCount > 0 && <CardsSkeleton count={cardsCount} />}
                    {chartLayout && <ChartsSkeleton layout={chartLayout} />}
                    {tableRows > 0 && <TableSkeleton rows={tableRows} columns={tableColumns} />}
                </>
            )}
        </div>
    );
}

export function WithPageSkeleton({
    loading,
    children,
    ...pageSkeletonProps
}: {
    loading: boolean;
    children: ReactNode;
} & PageSkeletonProps) {
    if (loading) {
        return <PageSkeleton {...pageSkeletonProps} />;
    }
    return <>{children}</>;
}