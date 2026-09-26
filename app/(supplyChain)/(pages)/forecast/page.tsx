"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Chart from "chart.js/auto";
import { SessionGuard } from "../../components/server/SessionGuard";
import Cards from "../../components/global/Cards";
import { CardsSkeleton } from "../../components/ui/SkeletonLoader";
import { AppButton } from "../../components/ui/AppButton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { toast } from "sonner";
import Portal from "../../components/client/Portal";
import ForecastExportModal from "./components/ForecastExportModal";
import MonthlyIntelligencePanel from "./components/MonthlyIntelligencePanel";

interface ForecastData {
    raw_db_stats: {
        total_parcels_in_db: number;
        total_pos_in_db: number;
        total_paid_pos_in_db?: number;
        total_blocked_devices_in_db?: number;
        total_sessions_in_db?: number;
        total_users_in_db?: number;
        total_appeals_in_db?: number;
        courier_breakdown: Record<string, number>;
        status_breakdown: Record<string, number>;
        positions_breakdown?: Record<string, number>;
        roles_breakdown?: Record<string, number>;
    };
    parcel_7_day: {
        predictions: number[];
        confidence_interval: {
            lower: number[];
            upper: number[];
        };
        total_next_week: number;
        confidence: string;
        model_used?: string;
        engine?: string;
        explanation?: string;
        dates: string[];
        previous_week_evaluation?: {
            has_evaluation: boolean;
            date_range: string;
            actual_volume: number;
            predicted_volume: number;
            met_percentage: number;
            accuracy_percentage: number;
            status: string;
            status_tone: 'emerald' | 'pink' | 'amber' | 'neutral';
            summary: string;
        };
        historical: {
            dates: string[];
            counts: number[];
            display_dates?: string[];
            display_counts?: number[];
            aggregation_type?: string;
            total_actual: number;
        };
        peak_insights?: {
            busiestMonth: { month: string; count: number };
            busiestDay: { day: string; count: number };
            busiestHour: { timeRange: string; count: number };
        };
    };
    expense_next_month: {
        prediction: number;
        confidence_interval: {
            lower: number;
            upper: number;
        };
        confidence: string;
        model_used?: string;
        engine?: string;
        explanation?: string;
        historical: {
            months: string[];
            amounts: number[];
            total_actual: number;
        };
    };
    blocked_devices_forecast: {
        total_blocked: number;
        active_blocked_count: number;
        unblocked_count: number;
        risk_level: 'Low' | 'Moderate' | 'Elevated' | 'Critical';
        predictions: number[];
        confidence_interval: {
            lower: number[];
            upper: number[];
        };
        total_next_week: number;
        confidence: string;
        model_used?: string;
        engine?: string;
        explanation?: string;
        dates: string[];
        historical: {
            dates: string[];
            counts: number[];
            display_dates?: string[];
            display_counts?: number[];
            aggregation_type?: string;
            total_actual: number;
        };
        reasons_breakdown?: Record<string, number>;
        platform_breakdown?: { mobile: number; desktop: number; tablet: number; unknown: number };
    };
    active_users_forecast: {
        current_active_users: number;
        unique_active_users: number;
        total_sessions: number;
        busiest_hour?: { timeRange: string; count: number };
        busiest_day?: { day: string; count: number };
        capacity_utilization?: {
            current_active: number;
            max_capacity: number;
            utilization_percentage: number;
        };
        predictions: number[];
        confidence_interval: {
            lower: number[];
            upper: number[];
        };
        total_next_week: number;
        avg_daily_projected: number;
        confidence: string;
        model_used?: string;
        engine?: string;
        explanation?: string;
        dates: string[];
        historical: {
            dates: string[];
            counts: number[];
            display_dates?: string[];
            display_counts?: number[];
            aggregation_type?: string;
            total_actual: number;
        };
        hourly_distribution?: Record<number, number>;
    };
    users_positions_analytics: {
        total_users: number;
        active_users_count: number;
        positions_breakdown: Record<string, number>;
        roles_breakdown: Record<string, number>;
        departments_breakdown?: Record<string, number>;
        predicted_next_month_users: number;
        growth_rate_percentage: number;
        confidence: string;
        explanation?: string;
        signup_history?: { months: string[]; counts: number[] };
    };
    appeals_forecast: {
        total_appeals: number;
        pending_count: number;
        approved_count: number;
        rejected_count: number;
        resolution_rate: number;
        role_breakdown?: Record<string, number>;
        predictions: number[];
        confidence_interval: {
            lower: number[];
            upper: number[];
        };
        total_next_week: number;
        confidence: string;
        model_used?: string;
        engine?: string;
        explanation?: string;
        dates: string[];
        historical: {
            dates: string[];
            counts: number[];
            display_dates?: string[];
            display_counts?: number[];
            aggregation_type?: string;
            total_actual: number;
        };
    };
    timestamp: string;
}

type ForecastModalType = 'parcels' | 'expense' | 'couriers' | 'active_users' | 'blocked_devices' | 'positions' | 'appeals';
type ForecastDomainFilter = 'all' | 'logistics' | 'workforce' | 'security' | 'appeals' | 'procurement';

interface ChartEmptyStateProps {
    icon: string;
    iconColor: string;
    iconBg: string;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

function ChartEmptyState({
    icon,
    iconColor,
    iconBg,
    title,
    description,
    actionLabel,
    onAction,
}: ChartEmptyStateProps) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 rounded-2xl bg-[#ebf0f7]/85 dark:bg-[#14151c]/90 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/70 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.2)]">
            <div className={`w-12 h-12 rounded-2xl ${iconBg} ${iconColor} flex items-center justify-center text-xl mb-2.5 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.4)] border border-white/40 dark:border-white/5`}>
                <i className={icon} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                {title}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1 leading-relaxed">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 shadow-[2px_2px_6px_rgba(166,175,195,0.35),-2px_-2px_6px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.6)] hover:border-pink-500/40 transition cursor-pointer"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}

interface ParsedAiSection {
    title?: string;
    content: string;
}

function parseAiSummarySections(rawText: string | null): ParsedAiSection[] {
    if (!rawText) return [];

    const lines = rawText.split('\n');
    const sections: ParsedAiSection[] = [];
    let currentTitle = '';
    let currentLines: string[] = [];

    const isHeaderLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        const clean = trimmed.replace(/^\d+\.\s*/, '').replace(/:$/, '').trim();
        return clean.length >= 3 && clean.length <= 80 && /^[A-Z\s&/–-]+$/.test(clean);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (isHeaderLine(trimmed)) {
            if (currentTitle || currentLines.length > 0) {
                sections.push({
                    title: currentTitle || undefined,
                    content: currentLines.join('\n').trim(),
                });
            }
            currentTitle = trimmed.replace(/^\d+\.\s*/, '').replace(/:$/, '').trim();
            currentLines = [];
        } else {
            if (trimmed || currentLines.length > 0) {
                currentLines.push(line);
            }
        }
    }

    if (currentTitle || currentLines.length > 0) {
        sections.push({
            title: currentTitle || undefined,
            content: currentLines.join('\n').trim(),
        });
    }

    // Fallback if no uppercase headers detected
    if (sections.length === 0) {
        return rawText.split('\n\n').filter(Boolean).map(chunk => ({
            content: chunk.trim()
        }));
    }

    return sections.filter(s => s.title || s.content);
}

export default function Forecast() {
    const [loading, setLoading] = useState(true);
    const [retraining, setRetraining] = useState(false);
    const [forecastData, setForecastData] = useState<ForecastData | null>(null);
    const [activeDomain, setActiveDomain] = useState<ForecastDomainFilter>('all');

    // ai summary
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [summarizing, setSummarizing] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isAiMinimized, setIsAiMinimized] = useState(false);

    // export modal state
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // modal state
    const [activeChartModal, setActiveChartModal] = useState<{
        isOpen: boolean;
        type: ForecastModalType;
        title: string;
        dataPointIndex?: number;
    }>({
        isOpen: false,
        type: 'parcels',
        title: '',
    });

    const parcelChartRef = useRef<HTMLCanvasElement>(null);
    const expenseChartRef = useRef<HTMLCanvasElement>(null);
    const courierPieRef = useRef<HTMLCanvasElement>(null);
    const activeUsersChartRef = useRef<HTMLCanvasElement>(null);
    const blockedDevicesChartRef = useRef<HTMLCanvasElement>(null);
    const positionsChartRef = useRef<HTMLCanvasElement>(null);
    const appealsChartRef = useRef<HTMLCanvasElement>(null);

    const parcelChartInstance = useRef<Chart | null>(null);
    const expenseChartInstance = useRef<Chart | null>(null);
    const courierPieInstance = useRef<Chart | null>(null);
    const activeUsersChartInstance = useRef<Chart | null>(null);
    const blockedDevicesChartInstance = useRef<Chart | null>(null);
    const positionsChartInstance = useRef<Chart | null>(null);
    const appealsChartInstance = useRef<Chart | null>(null);

    const generateAiSummary = async () => {
        if (!forecastData) {
            toast.error("Forecast data is still loading.");
            return;
        }
        try {
            setSummarizing(true);
            setIsAiModalOpen(true);
            const res = await fetch("/forecast/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ forecastData })
            });
            const data = await res.json();
            if (data.success && data.summary) {
                setAiSummary(data.summary);
                setIsAiMinimized(false);
            } else {
                throw new Error(data.error || "Failed to generate AI summary");
            }
        } catch (err: any) {
            console.error("AI Summary error:", err);
            toast.error(err.message || "Failed to generate AI summary");
        } finally {
            setSummarizing(false);
        }
    };

    const fetchForecast = useCallback(async (showNotification: boolean = false) => {
        try {
            if (showNotification) setRetraining(true);
            const res = await fetch("/forecast/api", { cache: "no-store" });
            const data = await res.json();
            if (data.success) {
                setForecastData(data);
                if (showNotification) {
                    toast.success("Forecast models synced with Supabase database!");
                }
            } else {
                throw new Error(data.error || "Failed to load forecast data");
            }
        } catch (err: any) {
            console.error("Forecast fetch error:", err);
            toast.error(err.message || "Failed to fetch forecasts");
        } finally {
            setLoading(false);
            setRetraining(false);
        }
    }, []);

    useEffect(() => {
        fetchForecast();
    }, [fetchForecast]);

    useEffect(() => {
        if (typeof window === "undefined" || !forecastData || loading) return;

        const timer = setTimeout(() => {
            const isDark = document.documentElement.classList.contains("dark");
            const gridColor = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
            const textColor = isDark ? "#8a8a8e" : "#64748B";

            // 1. 7D Parcel Volume
            if (parcelChartRef.current && forecastData?.parcel_7_day?.historical?.counts?.length) {
                if (parcelChartInstance.current) {
                    parcelChartInstance.current.destroy();
                    parcelChartInstance.current = null;
                }
                const ctx = parcelChartRef.current.getContext("2d");
                if (ctx) {
                    const histData = forecastData.parcel_7_day.historical;
                    const histLabels = (histData.display_dates || histData.dates || []).map(d => {
                        if (d.includes('-') && !d.includes('/')) {
                            const parts = d.split('-');
                            return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
                        }
                        return d;
                    });
                    const histCounts = histData.display_counts || histData.counts || [];
                    const fcDates = forecastData.parcel_7_day.dates || [];
                    const fcValues = forecastData.parcel_7_day.predictions || [];
                    const fcUpper = forecastData.parcel_7_day.confidence_interval.upper || [];
                    const fcLower = forecastData.parcel_7_day.confidence_interval.lower || [];
                    const fcLabels = fcDates.map((d, i) => {
                        const parts = d.split('-');
                        return parts.length === 3 ? `${parts[1]}/${parts[2]} (D+${i + 1})` : `D+${i + 1}`;
                    });
                    const allLabels = [...histLabels, ...fcLabels];
                    const actualSeries = [...histCounts, ...Array(fcValues.length).fill(null)];
                    const lastHistValue = histCounts.length > 0 ? histCounts[histCounts.length - 1] : 0;
                    const forecastSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastHistValue, ...fcValues];
                    const upperSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastHistValue, ...fcUpper];
                    const lowerSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastHistValue, ...fcLower];

                    parcelChartInstance.current = new Chart(ctx, {
                        type: "line",
                        data: {
                            labels: allLabels,
                            datasets: [
                                {
                                    label: "Upper 95% Confidence Bound",
                                    data: upperSeries,
                                    borderColor: "transparent",
                                    backgroundColor: isDark ? "rgba(229,22,126,0.15)" : "rgba(236,72,153,0.12)",
                                    fill: "+1",
                                    pointRadius: 0,
                                    tension: 0.3,
                                },
                                {
                                    label: "Lower 95% Confidence Bound",
                                    data: lowerSeries,
                                    borderColor: "transparent",
                                    backgroundColor: "transparent",
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0.3,
                                },
                                {
                                    label: `Actual History (${histData.aggregation_type || 'Daily'})`,
                                    data: actualSeries,
                                    borderColor: isDark ? "#38bdf8" : "#0284C7",
                                    backgroundColor: isDark ? "#38bdf8" : "#0284C7",
                                    borderWidth: 3,
                                    pointRadius: 4,
                                    pointHoverRadius: 6,
                                    tension: 0.25,
                                },
                                {
                                    label: "Predicted (Next 7 Days)",
                                    data: forecastSeries,
                                    borderColor: isDark ? "#e5167e" : "#EC4899",
                                    borderWidth: 2.5,
                                    borderDash: [6, 4],
                                    pointBackgroundColor: isDark ? "#e5167e" : "#EC4899",
                                    pointRadius: 4,
                                    tension: 0.25,
                                },
                            ],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: "index", intersect: false },
                            onClick: (event: any, elements: any) => {
                                const index = elements && elements.length > 0 ? elements[0].index : undefined;
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'parcels',
                                    title: '7-Day Parcel Volume Forecast Analysis',
                                    dataPointIndex: index,
                                });
                            },
                            plugins: {
                                legend: {
                                    position: "bottom",
                                    labels: {
                                        boxWidth: 12,
                                        boxHeight: 12,
                                        usePointStyle: true,
                                        color: textColor,
                                        filter: (item: any) => !/Bound/i.test(item.text),
                                    },
                                },
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: textColor } },
                                y: {
                                    grid: { color: gridColor },
                                    ticks: { color: textColor },
                                    title: { display: true, text: "Parcel Volume", color: textColor }
                                },
                            },
                        },
                    });
                }
            }

            // 2. Active Users & Session Concurrency Forecast
            if (activeUsersChartRef.current && forecastData?.active_users_forecast) {
                if (activeUsersChartInstance.current) {
                    activeUsersChartInstance.current.destroy();
                    activeUsersChartInstance.current = null;
                }
                const ctx = activeUsersChartRef.current.getContext("2d");
                if (ctx) {
                    const uData = forecastData.active_users_forecast;
                    const histLabels = (uData.historical.display_dates || uData.historical.dates || []).map(d => {
                        if (d.includes('-') && !d.includes('/')) {
                            const parts = d.split('-');
                            return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
                        }
                        return d;
                    });
                    const histCounts = uData.historical.display_counts || uData.historical.counts || [];
                    const fcDates = uData.dates || [];
                    const fcValues = uData.predictions || [];
                    const fcUpper = uData.confidence_interval.upper || [];
                    const fcLower = uData.confidence_interval.lower || [];
                    const fcLabels = fcDates.map((d, i) => `D+${i + 1}`);

                    const allLabels = [...histLabels, ...fcLabels];
                    const actualSeries = [...histCounts, ...Array(fcValues.length).fill(null)];
                    const lastVal = histCounts.length > 0 ? histCounts[histCounts.length - 1] : 0;
                    const fcSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastVal, ...fcValues];
                    const upperSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastVal, ...fcUpper];
                    const lowerSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastVal, ...fcLower];

                    activeUsersChartInstance.current = new Chart(ctx, {
                        type: "line",
                        data: {
                            labels: allLabels,
                            datasets: [
                                {
                                    label: "Upper Bound",
                                    data: upperSeries,
                                    borderColor: "transparent",
                                    backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.12)",
                                    fill: "+1",
                                    pointRadius: 0,
                                    tension: 0.3,
                                },
                                {
                                    label: "Lower Bound",
                                    data: lowerSeries,
                                    borderColor: "transparent",
                                    backgroundColor: "transparent",
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0.3,
                                },
                                {
                                    label: "Historical Sessions",
                                    data: actualSeries,
                                    borderColor: isDark ? "#60a5fa" : "#3b82f6",
                                    backgroundColor: isDark ? "#60a5fa" : "#3b82f6",
                                    borderWidth: 2.5,
                                    pointRadius: 4,
                                    tension: 0.25,
                                },
                                {
                                    label: "Projected Active Traffic (7D)",
                                    data: fcSeries,
                                    borderColor: isDark ? "#818cf8" : "#6366f1",
                                    borderWidth: 2.5,
                                    borderDash: [5, 4],
                                    pointBackgroundColor: isDark ? "#818cf8" : "#6366f1",
                                    pointRadius: 4,
                                    tension: 0.25,
                                },
                            ],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: "index", intersect: false },
                            onClick: () => {
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'active_users',
                                    title: 'Active Users & Session Concurrency Forecast',
                                });
                            },
                            plugins: {
                                legend: {
                                    position: "bottom",
                                    labels: {
                                        boxWidth: 10,
                                        boxHeight: 10,
                                        usePointStyle: true,
                                        color: textColor,
                                        filter: (item: any) => !/Bound/i.test(item.text),
                                    },
                                },
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: textColor } },
                                y: {
                                    beginAtZero: true,
                                    grid: { color: gridColor },
                                    ticks: { color: textColor },
                                    title: { display: true, text: "Active User Sessions", color: textColor }
                                },
                            },
                        },
                    });
                }
            }

            // 3. Blocked Devices Threat Forecast
            if (blockedDevicesChartRef.current && forecastData?.blocked_devices_forecast) {
                if (blockedDevicesChartInstance.current) {
                    blockedDevicesChartInstance.current.destroy();
                    blockedDevicesChartInstance.current = null;
                }
                const ctx = blockedDevicesChartRef.current.getContext("2d");
                if (ctx) {
                    const bData = forecastData.blocked_devices_forecast;
                    const histLabels = (bData.historical.display_dates || bData.historical.dates || []).map(d => {
                        if (d.includes('-') && !d.includes('/')) {
                            const parts = d.split('-');
                            return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
                        }
                        return d;
                    });
                    const histCounts = bData.historical.display_counts || bData.historical.counts || [];
                    const fcDates = bData.dates || [];
                    const fcValues = bData.predictions || [];
                    const fcLabels = fcDates.map((d, i) => `D+${i + 1}`);

                    const allLabels = [...histLabels, ...fcLabels];
                    const actualSeries = [...histCounts, ...Array(fcValues.length).fill(null)];
                    const lastVal = histCounts.length > 0 ? histCounts[histCounts.length - 1] : 0;
                    const fcSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastVal, ...fcValues];

                    blockedDevicesChartInstance.current = new Chart(ctx, {
                        type: "bar",
                        data: {
                            labels: allLabels,
                            datasets: [
                                {
                                    type: "bar" as const,
                                    label: "Actual Lockouts",
                                    data: actualSeries,
                                    backgroundColor: isDark ? "rgba(244, 63, 94, 0.75)" : "rgba(225, 29, 72, 0.75)",
                                    borderRadius: 4,
                                },
                                {
                                    type: "line" as const,
                                    label: "Projected Threat Rate (7D)",
                                    data: fcSeries,
                                    borderColor: isDark ? "#fb7185" : "#e11d48",
                                    borderWidth: 2,
                                    borderDash: [4, 4],
                                    pointBackgroundColor: "#e11d48",
                                    pointRadius: 4,
                                    tension: 0.25,
                                }
                            ],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            onClick: () => {
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'blocked_devices',
                                    title: 'Blocked Devices & Threat Forecaster',
                                });
                            },
                            plugins: {
                                legend: {
                                    position: "bottom",
                                    labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: textColor },
                                },
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: textColor } },
                                y: {
                                    beginAtZero: true,
                                    grid: { color: gridColor },
                                    ticks: { color: textColor },
                                    title: { display: true, text: "Device Lockouts", color: textColor }
                                },
                            },
                        },
                    });
                }
            }

            // 4. Users Positions & Roles Distribution
            if (positionsChartRef.current && forecastData?.users_positions_analytics?.positions_breakdown) {
                if (positionsChartInstance.current) {
                    positionsChartInstance.current.destroy();
                    positionsChartInstance.current = null;
                }
                const ctx = positionsChartRef.current.getContext("2d");
                if (ctx) {
                    const posMap = forecastData.users_positions_analytics.positions_breakdown;
                    const sortedEntries = Object.entries(posMap).sort((a, b) => b[1] - a[1]);
                    const labels = sortedEntries.map(e => e[0]);
                    const values = sortedEntries.map(e => e[1]);
                    const palette = [
                        '#e5167e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
                        '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#f97316'
                    ];

                    positionsChartInstance.current = new Chart(ctx, {
                        type: "doughnut",
                        data: {
                            labels: labels,
                            datasets: [{
                                data: values,
                                backgroundColor: palette.slice(0, labels.length),
                                borderWidth: 2,
                                borderColor: isDark ? "#191a24" : "#ffffff",
                                hoverOffset: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            onClick: () => {
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'positions',
                                    title: 'Workforce Positions & User Headcount Breakdown',
                                });
                            },
                            plugins: {
                                legend: {
                                    position: "right",
                                    labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: textColor, font: { size: 11 } }
                                },
                            },
                            cutout: "55%"
                        }
                    });
                }
            }

            // 5. Appeals Volume & Resolution Forecast
            if (appealsChartRef.current && forecastData?.appeals_forecast) {
                if (appealsChartInstance.current) {
                    appealsChartInstance.current.destroy();
                    appealsChartInstance.current = null;
                }
                const ctx = appealsChartRef.current.getContext("2d");
                if (ctx) {
                    const aData = forecastData.appeals_forecast;
                    const histLabels = (aData.historical.display_dates || aData.historical.dates || []).map(d => {
                        if (d.includes('-') && !d.includes('/')) {
                            const parts = d.split('-');
                            return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
                        }
                        return d;
                    });
                    const histCounts = aData.historical.display_counts || aData.historical.counts || [];
                    const fcDates = aData.dates || [];
                    const fcValues = aData.predictions || [];
                    const fcLabels = fcDates.map((d, i) => `D+${i + 1}`);

                    const allLabels = [...histLabels, ...fcLabels];
                    const actualSeries = [...histCounts, ...Array(fcValues.length).fill(null)];
                    const lastVal = histCounts.length > 0 ? histCounts[histCounts.length - 1] : 0;
                    const fcSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastVal, ...fcValues];

                    appealsChartInstance.current = new Chart(ctx, {
                        type: "line",
                        data: {
                            labels: allLabels,
                            datasets: [
                                {
                                    label: "Actual Filings",
                                    data: actualSeries,
                                    borderColor: isDark ? "#a855f7" : "#9333ea",
                                    backgroundColor: isDark ? "rgba(168, 85, 247, 0.15)" : "rgba(147, 51, 234, 0.12)",
                                    borderWidth: 2.5,
                                    fill: true,
                                    pointRadius: 4,
                                    tension: 0.25,
                                },
                                {
                                    label: "Projected Inflow (7D)",
                                    data: fcSeries,
                                    borderColor: isDark ? "#c084fc" : "#7e22ce",
                                    borderWidth: 2.5,
                                    borderDash: [5, 4],
                                    pointBackgroundColor: "#7e22ce",
                                    pointRadius: 4,
                                    tension: 0.25,
                                },
                            ],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: "index", intersect: false },
                            onClick: () => {
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'appeals',
                                    title: 'User Unblock Appeals Intake & Remediation Forecast',
                                });
                            },
                            plugins: {
                                legend: {
                                    position: "bottom",
                                    labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: textColor },
                                },
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: textColor } },
                                y: {
                                    beginAtZero: true,
                                    grid: { color: gridColor },
                                    ticks: { color: textColor },
                                    title: { display: true, text: "Appeals Filed", color: textColor }
                                },
                            },
                        },
                    });
                }
            }

            // 6. Expense Forecast
            if (expenseChartRef.current && (forecastData?.expense_next_month?.historical?.amounts?.length || forecastData?.expense_next_month?.prediction)) {
                if (expenseChartInstance.current) {
                    expenseChartInstance.current.destroy();
                    expenseChartInstance.current = null;
                }
                const ctx = expenseChartRef.current.getContext("2d");
                if (ctx) {
                    const histMonths = forecastData.expense_next_month.historical.months || [];
                    const histAmounts = forecastData.expense_next_month.historical.amounts || [];
                    const nextExpense = forecastData.expense_next_month.prediction || 0;
                    const lastMonthStr = histMonths[histMonths.length - 1] || new Date().toISOString().slice(0, 7);
                    const [y, m] = lastMonthStr.split('-');
                    const nextDate = new Date(parseInt(y), parseInt(m), 1);
                    const nextMonthLabel = `${nextDate.toLocaleString('default', { month: 'short' })} ${nextDate.getFullYear()} (Predicted)`;
                    const allMonths = [
                        ...histMonths.map(mo => {
                            const [yr, mon] = mo.split('-');
                            const d = new Date(parseInt(yr), parseInt(mon) - 1, 1);
                            return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()} (Actual)`;
                        }),
                        nextMonthLabel
                    ];
                    const actualExpenseData = [...histAmounts, null];
                    const fcExpenseData = [...Array(histAmounts.length).fill(null), nextExpense];
                    expenseChartInstance.current = new Chart(ctx, {
                        type: "bar",
                        data: {
                            labels: allMonths,
                            datasets: [
                                {
                                    label: "Actual Paid PO Expenses (₱)",
                                    data: actualExpenseData,
                                    backgroundColor: isDark ? "rgba(56, 189, 248, 0.85)" : "rgba(2, 132, 199, 0.85)",
                                    borderRadius: 6,
                                },
                                {
                                    label: "Predicted Next Month (₱)",
                                    data: fcExpenseData,
                                    backgroundColor: isDark ? "rgba(229, 22, 126, 0.85)" : "rgba(236, 72, 153, 0.85)",
                                    borderRadius: 6,
                                },
                            ],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            onClick: () => {
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'expense',
                                    title: 'Procurement Outlay & Budget Projections',
                                });
                            },
                            plugins: {
                                legend: {
                                    position: "bottom",
                                    labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, color: textColor },
                                },
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: textColor } },
                                y: {
                                    grid: { color: gridColor },
                                    ticks: { color: textColor, callback: (val: any) => `₱${Number(val).toLocaleString()}` },
                                },
                            },
                        },
                    });
                }
            }

            // 7. Courier Share
            if (courierPieRef.current && forecastData?.raw_db_stats?.courier_breakdown && Object.keys(forecastData.raw_db_stats.courier_breakdown).length > 0) {
                if (courierPieInstance.current) {
                    courierPieInstance.current.destroy();
                    courierPieInstance.current = null;
                }
                const ctx = courierPieRef.current.getContext("2d");
                if (ctx) {
                    const courierMap = forecastData.raw_db_stats.courier_breakdown;
                    const labels = Object.keys(courierMap);
                    const values = Object.values(courierMap);
                    const palette = [
                        '#e5167e', '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6',
                        '#ec4899', '#06b6d4', '#84cc16', '#ef4444', '#6366f1',
                    ];
                    courierPieInstance.current = new Chart(ctx, {
                        type: "doughnut",
                        data: {
                            labels: labels,
                            datasets: [{
                                data: values,
                                backgroundColor: palette.slice(0, labels.length),
                                borderWidth: 2,
                                borderColor: isDark ? "#1e293b" : "#ffffff",
                                hoverOffset: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            onClick: () => {
                                setActiveChartModal({
                                    isOpen: true,
                                    type: 'couriers',
                                    title: 'Courier Partner Volume Breakdown & Dispatch Allocation',
                                });
                            },
                            plugins: {
                                legend: {
                                    position: "right",
                                    labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: textColor, font: { size: 11 } }
                                },
                            },
                            cutout: "60%"
                        }
                    });
                }
            }
        }, 120);

        return () => {
            clearTimeout(timer);
            if (parcelChartInstance.current) { parcelChartInstance.current.destroy(); parcelChartInstance.current = null; }
            if (activeUsersChartInstance.current) { activeUsersChartInstance.current.destroy(); activeUsersChartInstance.current = null; }
            if (blockedDevicesChartInstance.current) { blockedDevicesChartInstance.current.destroy(); blockedDevicesChartInstance.current = null; }
            if (positionsChartInstance.current) { positionsChartInstance.current.destroy(); positionsChartInstance.current = null; }
            if (appealsChartInstance.current) { appealsChartInstance.current.destroy(); appealsChartInstance.current = null; }
            if (expenseChartInstance.current) { expenseChartInstance.current.destroy(); expenseChartInstance.current = null; }
            if (courierPieInstance.current) { courierPieInstance.current.destroy(); courierPieInstance.current = null; }
        };
    }, [forecastData, loading, activeDomain]);

    const handleExport = () => {
        if (!forecastData) {
            toast.error("No forecast data available to export.");
            return;
        }
        setIsExportModalOpen(true);
    };

    // Logistics stats
    const totalDbParcels = forecastData?.raw_db_stats?.total_parcels_in_db || 0;
    const weeklyTotal = forecastData?.parcel_7_day?.total_next_week || 0;
    const prevEval = forecastData?.parcel_7_day?.previous_week_evaluation;
    const courierMap = forecastData?.raw_db_stats?.courier_breakdown || {};
    const sortedCouriers = useMemo(() => Object.entries(courierMap).sort((a, b) => b[1] - a[1]), [courierMap]);
    const peakInsights = forecastData?.parcel_7_day?.peak_insights;
    const aggregationType = forecastData?.parcel_7_day?.historical?.aggregation_type || 'Daily';

    // Expense stats
    const expensePrediction = forecastData?.expense_next_month?.prediction || 0;
    const expenseLower = forecastData?.expense_next_month?.confidence_interval?.lower || 0;
    const expenseUpper = forecastData?.expense_next_month?.confidence_interval?.upper || 0;

    // Security & Blocked stats
    const blockedData = forecastData?.blocked_devices_forecast;
    const totalBlocked = blockedData?.total_blocked || 0;
    const activeBlocked = blockedData?.active_blocked_count || 0;
    const blocked7dProjected = blockedData?.total_next_week || 0;
    const riskLevel = blockedData?.risk_level || 'Low';

    // Users & Concurrency stats
    const activeUsersData = forecastData?.active_users_forecast;
    const currentActiveUsers = activeUsersData?.current_active_users || 0;
    const capacityPct = activeUsersData?.capacity_utilization?.utilization_percentage || 0;
    const avgDailySessions = activeUsersData?.avg_daily_projected || 0;

    // Positions & Roles stats
    const usersPositionsData = forecastData?.users_positions_analytics;
    const totalRegisteredUsers = usersPositionsData?.total_users || 0;
    const positionsBreakdown = usersPositionsData?.positions_breakdown || {};
    const sortedPositions = useMemo(() => Object.entries(positionsBreakdown).sort((a, b) => b[1] - a[1]), [positionsBreakdown]);
    const projectedNextMonthUsers = usersPositionsData?.predicted_next_month_users || totalRegisteredUsers;
    const userGrowthRate = usersPositionsData?.growth_rate_percentage || 0;

    // Appeals stats
    const appealsData = forecastData?.appeals_forecast;
    const totalAppeals = appealsData?.total_appeals || 0;
    const pendingAppeals = appealsData?.pending_count || 0;
    const resolutionRate = appealsData?.resolution_rate || 100;
    const appeals7dProjected = appealsData?.total_next_week || 0;

    return (
        <SessionGuard requiredRole={['Admin', 'Manager', 'Staff', 'Employee', 'Operator', 'Executive']}>
            <div className="p-6 space-y-6 bgCard dark:bg-ink/90 pb-16">
                {/* header */}
                <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-ink/20 pb-5">
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                            <img
                                src="/images/logo-remove-bg.png"
                                alt="Airship Express Logo"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div className="w-full min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 text-[11px] font-bold border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                                    <i className="fas fa-microchip text-pink-500 text-[10px]"/>
                                    <span>Airship Express</span>
                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                    <span className="text-pink-600 dark:text-pink-400">Holt-Winters & AutoTheta WASM</span>
                                </div>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                                    <span>Multi-Domain Forecast Engine</span>
                                </div>
                            </div>
                            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                                Demand, Workforce &amp; Security Forecasting Engine
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Automated time-series forecasting powered by high-performance in-memory WebAssembly. Analyzes historical Supabase parcels, procurement outlay, active user sessions, workforce positions, blocked devices, and lockout appeals.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                        <AppButton type="button" variant="pink" size="md" onClick={() => {
                            const el = document.getElementById("monthly-intelligence-section");
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}>
                            <i className="fa-solid fa-calendar-check text-xs" />
                            <span>Monthly AI Audit</span>
                        </AppButton>

                        <AppButton type="button" variant="primary" size="md" onClick={generateAiSummary} disabled={loading || summarizing || !forecastData}>
                            <i className={`fas ${summarizing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-xs`}/>
                            <span>{summarizing ? "Analyzing Models..." : "Summarize with AI"}</span>
                        </AppButton>

                        <AppButton type="button" variant="neutral" size="md" onClick={() => fetchForecast(true)} disabled={retraining || loading} title="Recalculate models from Supabase">
                            <i className={`fas fa-rotate text-xs ${retraining ? "fa-spin text-pink-500" : "text-slate-400"}`}/>
                            <span>{retraining ? "Recalculating..." : "Sync DB"}</span>
                        </AppButton>

                        <AppButton type="button" variant="neutral" size="md" onClick={handleExport} disabled={loading || !forecastData} title="Export Forecast Report">
                            <i className="fas fa-download text-xs text-slate-400"/>
                            <span>Export</span>
                        </AppButton>
                    </div>
                </div>

                {/* Domain Filter Switcher */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                        Domain View:
                    </span>
                    {[
                        { id: 'all', label: 'All Forecasts', icon: 'fa-cubes' },
                        { id: 'logistics', label: 'Parcels & Logistics', icon: 'fa-boxes-stacked' },
                        { id: 'workforce', label: 'Active Users & Positions', icon: 'fa-users-gear' },
                        { id: 'security', label: 'Blocked Devices & Threats', icon: 'fa-shield-halved' },
                        { id: 'appeals', label: 'Appeals & Remediation', icon: 'fa-scale-balanced' },
                        { id: 'procurement', label: 'Procurement Spend', icon: 'fa-money-bill-wave' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveDomain(tab.id as ForecastDomainFilter)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 cursor-pointer border ${
                                activeDomain === tab.id
                                    ? 'bg-pink-500 text-white border-pink-600 shadow-sm'
                                    : 'bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <i className={`fas ${tab.icon} text-[11px]`}></i>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* KPI Stat Cards Grid */}
                {loading && !forecastData ? (
                    <CardsSkeleton count={6} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"/>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        {/* 1. Parcels */}
                        <Cards
                            frontIcon="fa-solid fa-boxes-stacked"
                            header="Actual Parcels in DB"
                            data={String(totalDbParcels)}
                            arrow="fa-solid fa-database"
                            description={`7D Fcst: ${weeklyTotal} units`}
                            backBg="bg-ink dark:bg-slate-900"
                            backHeader="Parcels Breakdown"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Total registered parcels: ${totalDbParcels}\n7-Day Projected Intake: ${weeklyTotal}\nConfidence: ${forecastData?.parcel_7_day?.confidence || "0%"}\nTop Courier: ${sortedCouriers[0]?.[0] || 'None'}`}
                            tooltip="View parcel records"
                            tooltipLink="/parcels"
                            frontTextColor="text-blue-500 dark:text-blue-400"
                            descriptionTextColor="text-slate-500 dark:text-slate-400"
                        />

                        {/* 2. Active Users & Traffic */}
                        <Cards
                            frontIcon="fa-solid fa-users"
                            header="Active User Sessions"
                            data={String(currentActiveUsers)}
                            arrow="fa-solid fa-chart-simple"
                            description={`${capacityPct}% Capacity · ~${avgDailySessions}/day`}
                            backBg="bg-ink dark:bg-slate-900"
                            backHeader="User Concurrency"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Current Active Sessions: ${currentActiveUsers}\nUnique Active Accounts: ${activeUsersData?.unique_active_users || 0}\n7-Day Projected Volume: ${activeUsersData?.total_next_week || 0}\nPeak Concurrency Time: ${activeUsersData?.busiest_hour?.timeRange || 'N/A'}`}
                            tooltip="View active user sessions"
                            tooltipLink="/user-activity?tab=active_users"
                            frontTextColor="text-indigo-500 dark:text-indigo-400"
                            descriptionTextColor="text-slate-500 dark:text-slate-400"
                        />

                        {/* 3. Blocked Devices */}
                        <Cards
                            frontIcon="fa-solid fa-shield-halved"
                            header="Blocked Devices"
                            data={String(totalBlocked)}
                            arrow="fa-solid fa-shield-virus"
                            description={`${activeBlocked} Active · ${riskLevel} Threat`}
                            backBg="bg-ink dark:bg-slate-900"
                            backHeader="Security Outlook"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Total Lockouts in DB: ${totalBlocked}\nActive Blocked Devices: ${activeBlocked}\n7-Day Projected Threat Interventions: ${blocked7dProjected}\nThreat Posture: ${riskLevel}`}
                            tooltip="View blocked devices"
                            tooltipLink="/user-activity?tab=blocked"
                            frontTextColor={riskLevel === 'Critical' || riskLevel === 'Elevated' ? "text-rose-500 dark:text-rose-400" : "text-amber-500 dark:text-amber-400"}
                            descriptionTextColor="text-slate-500 dark:text-slate-400"
                        />

                        {/* 4. Total Users & Positions */}
                        <Cards
                            frontIcon="fa-solid fa-id-badge"
                            header="Workforce Users"
                            data={String(totalRegisteredUsers)}
                            arrow="fa-solid fa-arrow-trend-up"
                            description={`+${userGrowthRate}% Projected Next Mo`}
                            backBg="bg-ink dark:bg-slate-900"
                            backHeader="Positions Summary"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Registered User Accounts: ${totalRegisteredUsers}\nProjected Next Month Headcount: ${projectedNextMonthUsers}\nTop Position: ${sortedPositions[0]?.[0] || 'Office Staff'} (${sortedPositions[0]?.[1] || 0})\nDistinct Roles: ${Object.keys(positionsBreakdown).length}`}
                            tooltip="View employees and roles"
                            tooltipLink="/user-activity?tab=sessions"
                            frontTextColor="text-pink-500 dark:text-pink-400"
                            descriptionTextColor="text-slate-500 dark:text-slate-400"
                        />

                        {/* 5. Appeals & Remediation */}
                        <Cards
                            frontIcon="fa-solid fa-scale-balanced"
                            header="Unblock Appeals"
                            data={String(totalAppeals)}
                            arrow="fa-solid fa-gavel"
                            description={`${resolutionRate}% Resolved · ${pendingAppeals} Pend`}
                            backBg="bg-ink dark:bg-slate-900"
                            backHeader="Remediation Queue"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Total Appeals Logged: ${totalAppeals}\nPending Review: ${pendingAppeals}\nResolution Rate: ${resolutionRate}%\n7-Day Inflow Forecast: ${appeals7dProjected} requests`}
                            tooltip="View user appeals"
                            tooltipLink="/user-activity?tab=appeals"
                            frontTextColor="text-purple-500 dark:text-purple-400"
                            descriptionTextColor="text-slate-500 dark:text-slate-400"
                        />

                        {/* 6. Procurement Expense */}
                        <Cards
                            frontIcon="fa-solid fa-money-bill-wave"
                            header="Next Month PO Expense"
                            data={`₱${expensePrediction.toLocaleString()}`}
                            arrow="fa-solid fa-receipt"
                            description={expensePrediction > 0 ? `${forecastData?.expense_next_month?.confidence || "0%"} CI: ₱${expenseLower.toLocaleString()}` : "No qualifying POs"}
                            backBg="bg-ink dark:bg-slate-900"
                            backHeader="Expense Projections"
                            headerTextColor="text-muted dark:text-white/80"
                            backDescription={`Projected expense: ₱${expensePrediction.toLocaleString()}\nEstimated Lower Bound: ₱${expenseLower.toLocaleString()}\nEstimated Upper Bound: ₱${expenseUpper.toLocaleString()}\nConfidence: ${forecastData?.expense_next_month?.confidence || "0%"}`}
                            tooltip="View purchase orders"
                            tooltipLink="/procurement?tab=all"
                            frontTextColor="text-emerald-500 dark:text-emerald-400"
                            descriptionTextColor="text-slate-500 dark:text-slate-400"
                        />
                    </div>
                )}

                {/* AI Insights Banner */}
                {aiSummary && isAiMinimized && (
                    <div className="p-3 px-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.7)] flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setIsAiMinimized(false)}>
                            <div className="w-7 h-7 rounded-xl bg-gradient-to-b from-pink-500 to-pink-600 text-white flex items-center justify-center text-xs shadow-xs">
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                AI Operational &amp; Security Insights (Minimized)
                            </span>
                            <StatusBadge tone="pink" size="xs">
                                Gemini Analyzed
                            </StatusBadge>
                        </div>
                        <div className="flex items-center gap-2">
                            <AppButton type="button" variant="neutral" size="xs" onClick={() => setIsAiMinimized(false)}>
                                <i className="fas fa-chevron-down text-[10px]"></i>
                                <span>Restore Summary</span>
                            </AppButton>
                            <AppButton type="button" variant="pink" size="xs" onClick={() => setIsAiModalOpen(true)}>
                                <i className="fas fa-expand text-[10px]"></i>
                                <span>Pop-out Modal</span>
                            </AppButton>
                            <button
                                type="button"
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 cursor-pointer"
                                onClick={() => setAiSummary(null)}
                                title="Dismiss"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                )}

                {aiSummary && !isAiMinimized && (
                    <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] relative overflow-hidden">
                        <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center text-xs">
                                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                    Airship AI Operational, Workforce &amp; Security Synthesis
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge tone="pink" size="xs">
                                    Gemini 2.5 Flash
                                </StatusBadge>
                                <AppButton type="button" variant="neutral" size="xs" onClick={() => setIsAiMinimized(true)} title="Minimize to top bar">
                                    <i className="fas fa-minus text-[10px]"></i>
                                    <span>Minimize</span>
                                </AppButton>
                                <AppButton type="button" variant="pink" size="xs" onClick={() => setIsAiModalOpen(true)} title="Expand into full-screen dialog">
                                    <i className="fas fa-expand text-[10px]"></i>
                                    <span>Pop-out Modal</span>
                                </AppButton>
                                <button
                                    type="button"
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 cursor-pointer"
                                    onClick={() => setAiSummary(null)}
                                    title="Dismiss AI Insights"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-2">
                            {parseAiSummarySections(aiSummary).map((section, idx) => (
                                <div key={idx} className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs">
                                    {section.title && (
                                        <div className="font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-[11px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0"></span>
                                            {section.title}
                                        </div>
                                    )}
                                    <div className={`text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed ${section.title ? 'pl-3 border-l-2 border-pink-500/40' : ''}`}>
                                        {section.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Monthly Operational Intelligence Panel */}
                <div id="monthly-intelligence-section">
                    <MonthlyIntelligencePanel />
                </div>

                {/* Peak Logistics & Workforce Temporal Insights Banner */}
                {(activeDomain === 'all' || activeDomain === 'logistics' || activeDomain === 'workforce') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex items-center gap-3.5 transition-all">
                            <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center text-lg shrink-0">
                                <i className="fa-solid fa-calendar-days"></i>
                            </div>
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">Busiest Month</div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {loading ? "..." : (peakInsights?.busiestMonth?.month || "N/A")}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {loading ? "" : `${peakInsights?.busiestMonth?.count || 0} parcels recorded`}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex items-center gap-3.5 transition-all">
                            <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center text-lg shrink-0">
                                <i className="fa-solid fa-calendar-day"></i>
                            </div>
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">Peak Incoming Day</div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {loading ? "..." : (peakInsights?.busiestDay?.day || "N/A")}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {loading ? "" : `${peakInsights?.busiestDay?.count || 0} parcels peak`}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex items-center gap-3.5 transition-all">
                            <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center text-lg shrink-0">
                                <i className="fa-solid fa-clock"></i>
                            </div>
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">Peak User &amp; Parcel Hours</div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {loading ? "..." : (activeUsersData?.busiest_hour?.timeRange || peakInsights?.busiestHour?.timeRange || "N/A")}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {loading ? "" : `Peak login & scanner concurrency`}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 1. Parcels Forecast Section */}
                {(activeDomain === 'all' || activeDomain === 'logistics') && (
                    <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] transition-all">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-3 flex-wrap">
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2 flex-wrap">
                                    <span>Parcel Volume: Actual Supabase Data → 7-Day Prediction</span>
                                    <StatusBadge tone="pink" icon="fas fa-hand-pointer" size="xs">
                                        Click chart to inspect
                                    </StatusBadge>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {totalDbParcels} actual parcels recorded (Max 6 Months) · {forecastData?.parcel_7_day?.model_used || "Holt-Winters Seasonal"} WASM with {forecastData?.parcel_7_day?.confidence || "0%"} Confidence Interval
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {prevEval?.has_evaluation && (
                                    <StatusBadge tone={prevEval.status_tone || 'emerald'} icon="fas fa-bullseye" size="xs">
                                        Prev Week: {prevEval.met_percentage}% Met ({prevEval.actual_volume}/{prevEval.predicted_volume})
                                    </StatusBadge>
                                )}
                                <StatusBadge tone={(forecastData?.parcel_7_day?.confidence && forecastData.parcel_7_day.confidence !== '0%') ? 'pink' : 'neutral'} icon="fas fa-shield-halved" size="xs">
                                    {forecastData?.parcel_7_day?.confidence || "0%"} Confidence
                                </StatusBadge>
                                <StatusBadge tone="neutral" size="xs">
                                    {aggregationType} Resolution
                                </StatusBadge>
                                <AppButton type="button" variant="pink" size="xs" onClick={() => setActiveChartModal({
                                    isOpen: true,
                                    type: 'parcels',
                                    title: '7-Day Parcel Volume Forecast Analysis',
                                })}>
                                    <i className="fas fa-chart-line text-[10px]"/>
                                    <span>Inspect Model</span>
                                </AppButton>
                            </div>
                        </div>
                        <div className="mt-4 relative h-80 w-full cursor-pointer">
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-[#f0f3f8]/70 dark:bg-[#191a24]/70 z-10">
                                    <i className="fas fa-circle-notch fa-spin text-pink-500 text-2xl"></i>
                                </div>
                            )}
                            {!loading && totalDbParcels === 0 && (!forecastData?.parcel_7_day?.predictions?.length || forecastData.parcel_7_day.predictions.every((p: number) => p === 0)) && (
                                <ChartEmptyState
                                    icon="fas fa-box-open"
                                    iconColor="text-pink-500"
                                    iconBg="bg-pink-500/10 dark:bg-pink-500/20"
                                    title="No Parcel Volume Records"
                                    description="No historical parcel intake or dispatch records found to generate 7-day predictive curves."
                                    actionLabel="Refresh Data"
                                    onAction={() => fetchForecast(true)}
                                />
                            )}
                            <canvas ref={parcelChartRef} className="block"></canvas>
                        </div>
                    </div>
                )}

                {/* 2. Active Users & Positions Forecasting Section */}
                {(activeDomain === 'all' || activeDomain === 'workforce') && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Active Users Concurrency Chart */}
                        <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col justify-between transition-all">
                            <div>
                                <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-3 flex-wrap">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                            <i className="fas fa-users-line text-indigo-500"></i>
                                            <span>Active Users &amp; Session Concurrency (7D Forecast)</span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {currentActiveUsers} active sessions now · ~{avgDailySessions} projected/day · {capacityPct}% load
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge tone="indigo" size="xs">
                                            {activeUsersData?.confidence || "85%"} Confidence
                                        </StatusBadge>
                                        <AppButton type="button" variant="neutral" size="xs" onClick={() => setActiveChartModal({
                                            isOpen: true,
                                            type: 'active_users',
                                            title: 'Active Users & Session Concurrency Forecast',
                                        })}>
                                            <i className="fas fa-chart-line text-[10px]"/>
                                            <span>Inspect</span>
                                        </AppButton>
                                    </div>
                                </div>
                                <div className="mt-4 relative h-70 w-full cursor-pointer">
                                    {loading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#f0f3f8]/70 dark:bg-[#191a24]/70 z-10">
                                            <i className="fas fa-circle-notch fa-spin text-indigo-500 text-2xl"></i>
                                        </div>
                                    )}
                                    {!loading && (activeUsersData?.total_sessions || 0) === 0 && (activeUsersData?.total_next_week || 0) === 0 && (!activeUsersData?.predictions?.length || activeUsersData.predictions.every((p: number) => p === 0)) && (
                                        <ChartEmptyState
                                            icon="fas fa-users-slash"
                                            iconColor="text-indigo-500"
                                            iconBg="bg-indigo-500/10 dark:bg-indigo-500/20"
                                            title="No Active User Sessions"
                                            description="No user login activity recorded yet. Concurrency forecast models will automatically initialize as employees log in."
                                        />
                                    )}
                                    <canvas ref={activeUsersChartRef} className="block"></canvas>
                                </div>
                            </div>
                            <div className="mt-3 p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs text-slate-600 dark:text-slate-300">
                                <i className="fas fa-info-circle text-indigo-500 mr-1.5"></i>
                                Peak operational sessions cluster at <b>{activeUsersData?.busiest_hour?.timeRange || '9:00 AM - 11:00 AM'}</b> on <b>{activeUsersData?.busiest_day?.day || 'Mondays'}</b>.
                            </div>
                        </div>

                        {/* User Positions Breakdown Chart */}
                        <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col justify-between transition-all">
                            <div>
                                <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-3 flex-wrap">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                            <i className="fas fa-sitemap text-pink-500"></i>
                                            <span>User Positions &amp; Workforce Structure</span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {totalRegisteredUsers} registered user accounts across {sortedPositions.length} positions
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge tone="pink" size="xs">
                                            +{userGrowthRate}% Next Mo
                                        </StatusBadge>
                                        <AppButton type="button" variant="pink" size="xs" onClick={() => setActiveChartModal({
                                            isOpen: true,
                                            type: 'positions',
                                            title: 'Workforce Positions & User Headcount Breakdown',
                                        })}>
                                            <i className="fas fa-pie-chart text-[10px]"/>
                                            <span>Positions</span>
                                        </AppButton>
                                    </div>
                                </div>
                                <div className="mt-4 relative h-70 w-full cursor-pointer">
                                    {loading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#f0f3f8]/70 dark:bg-[#191a24]/70 z-10">
                                            <i className="fas fa-circle-notch fa-spin text-pink-500 text-2xl"></i>
                                        </div>
                                    )}
                                    {!loading && (sortedPositions.length === 0 || totalRegisteredUsers === 0) && (
                                        <ChartEmptyState
                                            icon="fas fa-sitemap"
                                            iconColor="text-pink-500"
                                            iconBg="bg-pink-500/10 dark:bg-pink-500/20"
                                            title="No Workforce Positions Registered"
                                            description="No registered user profiles found in the database to plot position and role hierarchy."
                                        />
                                    )}
                                    <canvas ref={positionsChartRef} className="block"></canvas>
                                </div>
                            </div>
                            <div className="mt-3 p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs text-slate-600 dark:text-slate-300">
                                <i className="fas fa-lightbulb text-amber-500 mr-1.5"></i>
                                <b>Growth Projection:</b> Next month headcount projects to expand to <b>{projectedNextMonthUsers} users</b> (+{userGrowthRate}% growth trajectory).
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Blocked Devices & Appeals Forecasting Section */}
                {(activeDomain === 'all' || activeDomain === 'security' || activeDomain === 'appeals') && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Blocked Devices Forecast */}
                        <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col justify-between transition-all">
                            <div>
                                <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-3 flex-wrap">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                            <i className="fas fa-shield-halved text-rose-500"></i>
                                            <span>Blocked Devices &amp; Threat Forecaster (7D)</span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {totalBlocked} total lockouts · {activeBlocked} active · {blocked7dProjected} projected 7D interventions
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge tone={riskLevel === 'Critical' || riskLevel === 'Elevated' ? 'pink' : 'neutral'} size="xs">
                                            {riskLevel} Threat Level
                                        </StatusBadge>
                                        <AppButton type="button" variant="neutral" size="xs" onClick={() => setActiveChartModal({
                                            isOpen: true,
                                            type: 'blocked_devices',
                                            title: 'Blocked Devices & Threat Forecaster',
                                        })}>
                                            <i className="fas fa-shield-virus text-[10px]"/>
                                            <span>Inspect</span>
                                        </AppButton>
                                    </div>
                                </div>
                                <div className="mt-4 relative h-70 w-full cursor-pointer">
                                    {loading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#f0f3f8]/70 dark:bg-[#191a24]/70 z-10">
                                            <i className="fas fa-circle-notch fa-spin text-rose-500 text-2xl"></i>
                                        </div>
                                    )}
                                    {!loading && totalBlocked === 0 && (blockedData?.total_next_week || 0) === 0 && (!blockedData?.predictions?.length || blockedData.predictions.every((p: number) => p === 0)) && (
                                        <ChartEmptyState
                                            icon="fas fa-shield-check"
                                            iconColor="text-emerald-500"
                                            iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
                                            title="No Security Threats / Zero Blocked Devices"
                                            description="Baseline security posture is clean. Zero device lockouts or suspicious intrusion spikes detected."
                                        />
                                    )}
                                    <canvas ref={blockedDevicesChartRef} className="block"></canvas>
                                </div>
                            </div>
                            <div className="mt-3 p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs text-slate-600 dark:text-slate-300">
                                <i className="fas fa-shield-check text-rose-500 mr-1.5"></i>
                                Threat forecaster runs AutoTheta trend isolation to detect anomalous credential stuffing or suspicious authentication patterns.
                            </div>
                        </div>

                        {/* Appeals Volume & Remediation Forecast */}
                        <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col justify-between transition-all">
                            <div>
                                <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-3 flex-wrap">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                            <i className="fas fa-scale-balanced text-purple-500"></i>
                                            <span>User Unblock Appeals Intake (7D Forecast)</span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {totalAppeals} appeals · {resolutionRate}% resolved · {pendingAppeals} pending review
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge tone="purple" size="xs">
                                            {resolutionRate}% Resolved
                                        </StatusBadge>
                                        <AppButton type="button" variant="neutral" size="xs" onClick={() => setActiveChartModal({
                                            isOpen: true,
                                            type: 'appeals',
                                            title: 'User Unblock Appeals Intake & Remediation Forecast',
                                        })}>
                                            <i className="fas fa-gavel text-[10px]"/>
                                            <span>Inspect</span>
                                        </AppButton>
                                    </div>
                                </div>
                                <div className="mt-4 relative h-70 w-full cursor-pointer">
                                    {loading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#f0f3f8]/70 dark:bg-[#191a24]/70 z-10">
                                            <i className="fas fa-circle-notch fa-spin text-purple-500 text-2xl"></i>
                                        </div>
                                    )}
                                    {!loading && totalAppeals === 0 && (appealsData?.total_next_week || 0) === 0 && (!appealsData?.predictions?.length || appealsData.predictions.every((p: number) => p === 0)) && (
                                        <ChartEmptyState
                                            icon="fas fa-scale-balanced"
                                            iconColor="text-purple-500"
                                            iconBg="bg-purple-500/10 dark:bg-purple-500/20"
                                            title="No Unblock Appeals Logged"
                                            description="Lockout remediation queue is completely clear. No active appeals pending review."
                                        />
                                    )}
                                    <canvas ref={appealsChartRef} className="block"></canvas>
                                </div>
                            </div>
                            <div className="mt-3 p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs text-slate-600 dark:text-slate-300">
                                <i className="fas fa-check-double text-purple-500 mr-1.5"></i>
                                <b>Remediation Posture:</b> Projected incoming volume of <b>{appeals7dProjected} unblock appeals</b> next week with a healthy {resolutionRate}% clearance efficiency.
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Procurement Spend & Courier Share Section */}
                {(activeDomain === 'all' || activeDomain === 'procurement' || activeDomain === 'logistics') && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* PO Expenses */}
                        <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col justify-between transition-all">
                            <div>
                                <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-3 flex-wrap">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                            <i className="fas fa-money-bill-wave text-emerald-500"></i>
                                            <span>Procurement Spend: Monthly Paid POs → Next Month Forecast</span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Tracked across confirmed and delivered purchase orders
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge tone={(forecastData?.expense_next_month?.confidence && forecastData.expense_next_month.confidence !== '0%') ? 'emerald' : 'neutral'} size="xs">
                                            {forecastData?.expense_next_month?.confidence || "0%"} Confidence
                                        </StatusBadge>
                                        <AppButton type="button" variant="success" size="xs" onClick={() => setActiveChartModal({
                                            isOpen: true,
                                            type: 'expense',
                                            title: 'Procurement Outlay & Budget Projections',
                                        })}>
                                            <i className="fas fa-calculator text-[10px]"/>
                                            <span>Inspect</span>
                                        </AppButton>
                                    </div>
                                </div>
                                <div className="mt-4 relative h-70 w-full cursor-pointer">
                                    {loading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#f0f3f8]/70 dark:bg-[#191a24]/70 z-10">
                                            <i className="fas fa-circle-notch fa-spin text-emerald-500 text-2xl"></i>
                                        </div>
                                    )}
                                    {!loading && (forecastData?.expense_next_month?.prediction || 0) === 0 && (forecastData?.expense_next_month?.historical?.amounts || []).every((a: number) => a === 0) && (forecastData?.raw_db_stats?.total_paid_pos_in_db || 0) === 0 && (
                                        <ChartEmptyState
                                            icon="fas fa-file-invoice-dollar"
                                            iconColor="text-emerald-500"
                                            iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
                                            title="No Paid Purchase Orders"
                                            description="No confirmed or delivered purchase orders recorded. Expense forecast models will compute once PO spend occurs."
                                        />
                                    )}
                                    <canvas ref={expenseChartRef} className="block"></canvas>
                                </div>
                            </div>
                            <div className="mt-3 p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs text-slate-600 dark:text-slate-300">
                                <i className="fas fa-chart-line text-emerald-500 mr-1.5"></i>
                                Expense projections apply AutoTheta trend-fitting to paid purchase orders to assist procurement budgeting.
                            </div>
                        </div>

                        {/* Courier Share */}
                        <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col justify-between transition-all">
                            <div>
                                <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-3 flex-wrap">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                            <i className="fas fa-truck-fast text-pink-500"></i>
                                            <span>Courier Volume Share Distribution</span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Distribution breakdown across courier partners from {totalDbParcels} parcels
                                        </div>
                                    </div>
                                    <AppButton type="button" variant="pink" size="xs" onClick={() => setActiveChartModal({
                                        isOpen: true,
                                        type: 'couriers',
                                        title: 'Courier Partner Volume Breakdown & Dispatch Allocation',
                                    })}>
                                        <i className="fas fa-pie-chart text-[10px]"/>
                                        <span>Details</span>
                                    </AppButton>
                                </div>
                                <div className="mt-4 relative h-70 w-full cursor-pointer">
                                    {loading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#f0f3f8]/70 dark:bg-[#191a24]/70 z-10">
                                            <i className="fas fa-circle-notch fa-spin text-pink-500 text-2xl"></i>
                                        </div>
                                    )}
                                    {!loading && (sortedCouriers.length === 0 || sortedCouriers.every(([, count]) => count === 0)) && (
                                        <ChartEmptyState
                                            icon="fas fa-truck-fast"
                                            iconColor="text-pink-500"
                                            iconBg="bg-pink-500/10 dark:bg-pink-500/20"
                                            title="No Courier Partner Allocation"
                                            description="No courier provider assignments recorded across current parcel dispatches."
                                        />
                                    )}
                                    <canvas ref={courierPieRef} className="block"></canvas>
                                </div>
                            </div>
                            <div className="mt-3 p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs text-slate-600 dark:text-slate-300">
                                <i className="fas fa-lightbulb text-amber-500 mr-1.5"></i>
                                <b>Recommendation:</b> Focus dispatch sorting and dedicated staging areas for top couriers ({sortedCouriers.slice(0, 2).map(([name, count]) => `${name}: ${count}`).join(', ') || 'N/A'}) to optimize throughput.
                            </div>
                        </div>
                    </div>
                )}

                {/* Detailed Inspection Modal */}
                {activeChartModal.isOpen && forecastData && (
                    <Portal>
                        <div
                            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) setActiveChartModal(prev => ({ ...prev, isOpen: false }));
                            }}
                        >
                            <div
                                className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                                data-lenis-prevent
                            >
                                {/* Header */}
                                <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg text-white shadow-xs ${
                                            activeChartModal.type === 'expense' ? 'bg-gradient-to-b from-emerald-500 to-emerald-600' :
                                            activeChartModal.type === 'active_users' ? 'bg-gradient-to-b from-indigo-500 to-indigo-600' :
                                            activeChartModal.type === 'blocked_devices' ? 'bg-gradient-to-b from-rose-500 to-rose-600' :
                                            activeChartModal.type === 'appeals' ? 'bg-gradient-to-b from-purple-500 to-purple-600' :
                                            'bg-gradient-to-b from-pink-500 to-pink-600'
                                        }`}>
                                            <i className={`fas ${
                                                activeChartModal.type === 'parcels' ? 'fa-boxes-stacked' :
                                                activeChartModal.type === 'expense' ? 'fa-money-bill-wave' :
                                                activeChartModal.type === 'active_users' ? 'fa-users' :
                                                activeChartModal.type === 'blocked_devices' ? 'fa-shield-halved' :
                                                activeChartModal.type === 'positions' ? 'fa-sitemap' :
                                                activeChartModal.type === 'appeals' ? 'fa-scale-balanced' :
                                                'fa-chart-pie'
                                            }`}></i>
                                        </div>
                                        <div>
                                            <h2 className="text-base font-bold text-slate-900 dark:text-white">{activeChartModal.title}</h2>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Statistical breakdown, algorithmic explanation, and underlying database metrics</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setActiveChartModal(prev => ({ ...prev, isOpen: false }))} aria-label="Close modal">
                                            <i className="fas fa-times text-xs"></i>
                                        </AppButton>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1 overscroll-contain" data-lenis-prevent>
                                    {/* Parcels Inspection */}
                                    {activeChartModal.type === 'parcels' && (
                                        <>
                                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider">7-Day Projected Total</div>
                                                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                        {forecastData.parcel_7_day.total_next_week.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">parcels</span>
                                                    </div>
                                                    <div className="text-xs text-pink-600 dark:text-pink-400 mt-1 font-semibold">
                                                        {forecastData.parcel_7_day.confidence || "95%"} Confidence
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prev Week Target Met</div>
                                                    <div className="text-2xl font-bold text-pink-600 dark:text-pink-400 mt-1">
                                                        {prevEval?.has_evaluation ? `${prevEval.met_percentage}%` : 'N/A'}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate font-medium">
                                                        {prevEval?.has_evaluation ? `${prevEval.actual_volume} actual / ${prevEval.predicted_volume} pred` : 'No prior window'}
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Algorithm Used</div>
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                                                        {forecastData.parcel_7_day.model_used || "Holt-Winters Seasonal"}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        {forecastData.parcel_7_day.engine || "Rust/WASM Core"}
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data Sampling</div>
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                                        {forecastData.raw_db_stats.total_parcels_in_db.toLocaleString()} Parcels
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        {forecastData.parcel_7_day.historical.dates.length} Days Sampled
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                                                <div className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-2">
                                                    <i className="fas fa-lightbulb text-amber-500"></i>
                                                    How Did the System Compute This?
                                                </div>
                                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {forecastData.parcel_7_day.explanation || "The system collects logged parcels from Supabase over the past 6 months and feeds the daily intake volumes into an in-memory Rust/WASM Holt-Winters seasonality forecaster, decomposing past trends into weekly recurring cycles."}
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                                    <i className="fas fa-calendar-week text-pink-500"></i>
                                                    Next 7 Days Day-by-Day Forecast Breakdown
                                                </h4>
                                                <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                                                            <tr>
                                                                <th className="py-2.5 px-4">Forecast Horizon</th>
                                                                <th className="py-2.5 px-4">Projected Date</th>
                                                                <th className="py-2.5 px-4 text-center">Lower Bound</th>
                                                                <th className="py-2.5 px-4 text-right font-bold text-pink-600 dark:text-pink-400">Predicted Volume</th>
                                                                <th className="py-2.5 px-4 text-center">Upper Bound</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                                                            {forecastData.parcel_7_day.dates.map((dateStr, idx) => {
                                                                const pred = forecastData.parcel_7_day.predictions[idx] || 0;
                                                                const lower = forecastData.parcel_7_day.confidence_interval.lower[idx] || 0;
                                                                const upper = forecastData.parcel_7_day.confidence_interval.upper[idx] || 0;
                                                                const dateObj = new Date(dateStr);
                                                                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                                                                return (
                                                                    <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition">
                                                                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">Day +{idx + 1}</td>
                                                                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{dayName}, {dateStr}</td>
                                                                        <td className="py-2.5 px-4 text-center text-slate-500 dark:text-slate-400 font-mono">{lower}</td>
                                                                        <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white font-mono text-sm">
                                                                            {pred} <span className="text-[10px] font-normal text-slate-400">units</span>
                                                                        </td>
                                                                        <td className="py-2.5 px-4 text-center text-slate-500 dark:text-slate-400 font-mono">{upper}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Active Users Inspection */}
                                    {activeChartModal.type === 'active_users' && (
                                        <>
                                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Current Active Users</div>
                                                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                        {activeUsersData?.current_active_users || 0}
                                                    </div>
                                                    <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-semibold">
                                                        {capacityPct}% Capacity Utilization
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Projected Daily Average</div>
                                                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                                        ~{avgDailySessions}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        Sessions per day next 7D
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Peak Operational Window</div>
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                                        {activeUsersData?.busiest_hour?.timeRange || 'N/A'}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        Peak Day: {activeUsersData?.busiest_day?.day || 'Monday'}
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Algorithm</div>
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                                                        {activeUsersData?.model_used || "AutoTheta Forecaster"}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        Confidence: {activeUsersData?.confidence || "85%"}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 space-y-2">
                                                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                                    <i className="fas fa-lightbulb text-amber-500"></i>
                                                    Workforce Concurrency &amp; Capacity Intelligence
                                                </div>
                                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {activeUsersData?.explanation || "Evaluates total historical session tokens and active heartbeats to project daily login concurrency, staff scanner load, and system capacity boundaries."}
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                                    <i className="fas fa-calendar-week text-indigo-500"></i>
                                                    7-Day Active Session Projection
                                                </h4>
                                                <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                                                            <tr>
                                                                <th className="py-2.5 px-4">Day</th>
                                                                <th className="py-2.5 px-4">Date</th>
                                                                <th className="py-2.5 px-4 text-center">Lower 95% Bound</th>
                                                                <th className="py-2.5 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">Projected Sessions</th>
                                                                <th className="py-2.5 px-4 text-center">Upper 95% Bound</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                                                            {(activeUsersData?.dates || []).map((dateStr, idx) => {
                                                                const pred = activeUsersData?.predictions[idx] || 0;
                                                                const lower = activeUsersData?.confidence_interval.lower[idx] || 0;
                                                                const upper = activeUsersData?.confidence_interval.upper[idx] || 0;
                                                                const dateObj = new Date(dateStr);
                                                                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                                                                return (
                                                                    <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition">
                                                                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">Day +{idx + 1}</td>
                                                                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{dayName}, {dateStr}</td>
                                                                        <td className="py-2.5 px-4 text-center text-slate-500 dark:text-slate-400 font-mono">{lower}</td>
                                                                        <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white font-mono text-sm">
                                                                            {pred} <span className="text-[10px] font-normal text-slate-400">sessions</span>
                                                                        </td>
                                                                        <td className="py-2.5 px-4 text-center text-slate-500 dark:text-slate-400 font-mono">{upper}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Blocked Devices Inspection */}
                                    {activeChartModal.type === 'blocked_devices' && (
                                        <>
                                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Total Blocked Devices</div>
                                                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                        {totalBlocked}
                                                    </div>
                                                    <div className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-semibold">
                                                        {activeBlocked} Currently Active Lockouts
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Threat Risk Level</div>
                                                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                                                        {riskLevel}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        {blocked7dProjected} projected interventions
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Platform Breakdown</div>
                                                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                                                        Desktop: {blockedData?.platform_breakdown?.desktop || 0} · Mobile: {blockedData?.platform_breakdown?.mobile || 0}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        Tablet: {blockedData?.platform_breakdown?.tablet || 0}
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Forecast Model</div>
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                                                        {blockedData?.model_used || "AutoTheta Forecaster"}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        Confidence: {blockedData?.confidence || "85%"}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 space-y-2">
                                                <div className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
                                                    <i className="fas fa-shield-halved text-rose-500"></i>
                                                    Security Lockout Analysis &amp; Protective Rules
                                                </div>
                                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {blockedData?.explanation || "Analyzes security lockouts triggered across user devices. Protects against brute force and multi-device session tampering while projecting future remediation interventions."}
                                                </p>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                                                    <b>Executive &amp; Admin Protection Policy:</b> Executive and Admin accounts are strictly protected from blocking to ensure continuous supply chain command and governance.
                                                </div>
                                            </div>

                                            {blockedData?.reasons_breakdown && Object.keys(blockedData.reasons_breakdown).length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
                                                        Top Block Reasons Distribution
                                                    </h4>
                                                    <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40">
                                                        <table className="w-full text-xs text-left">
                                                            <thead className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                                                                <tr>
                                                                    <th className="py-2.5 px-4">Reason / Threat Vector</th>
                                                                    <th className="py-2.5 px-4 text-right">Lockout Count</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                                                                {Object.entries(blockedData.reasons_breakdown).map(([reason, cnt], idx) => (
                                                                    <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition">
                                                                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{reason}</td>
                                                                        <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{cnt}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* User Positions Inspection */}
                                    {activeChartModal.type === 'positions' && (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider">Total User Profiles</div>
                                                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                        {totalRegisteredUsers}
                                                    </div>
                                                    <div className="text-xs text-pink-600 dark:text-pink-400 mt-1 font-semibold">
                                                        {usersPositionsData?.active_users_count || totalRegisteredUsers} Active Accounts
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Projected Next Month Headcount</div>
                                                    <div className="text-2xl font-bold text-pink-600 dark:text-pink-400 mt-1">
                                                        {projectedNextMonthUsers}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        +{userGrowthRate}% Monthly Growth
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Top Positions Count</div>
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                                                        {sortedPositions[0]?.[0] || 'Office Staff'} ({sortedPositions[0]?.[1] || 0})
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        {sortedPositions.length} defined job positions
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 space-y-2">
                                                <div className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-2">
                                                    <i className="fas fa-sitemap text-pink-500"></i>
                                                    Workforce Positions Distribution Breakdown
                                                </div>
                                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {usersPositionsData?.explanation || "Classifies all registered supply chain users by their exact designated positions (Office-in-Charge, Project Coordinator, Appraiser, Admin Assistant, Office Staff, Sales Representative, CSR / Mktg Staff, HR Officer, HR Generalist, etc.)."}
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
                                                    Positions Headcount Leaderboard
                                                </h4>
                                                <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                                                            <tr>
                                                                <th className="py-2.5 px-4">Rank</th>
                                                                <th className="py-2.5 px-4">Position Title</th>
                                                                <th className="py-2.5 px-4 text-center">Assigned Users</th>
                                                                <th className="py-2.5 px-4 text-right">Workforce Share</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                                                            {sortedPositions.map(([posName, count], idx) => {
                                                                const pct = totalRegisteredUsers > 0 ? ((count / totalRegisteredUsers) * 100).toFixed(1) : '0';
                                                                return (
                                                                    <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition">
                                                                        <td className="py-2.5 px-4 font-bold text-slate-700 dark:text-slate-300">#{idx + 1}</td>
                                                                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{posName}</td>
                                                                        <td className="py-2.5 px-4 text-center font-mono font-semibold">{count}</td>
                                                                        <td className="py-2.5 px-4 text-right font-mono font-bold text-pink-600 dark:text-pink-400">{pct}%</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Appeals Inspection */}
                                    {activeChartModal.type === 'appeals' && (
                                        <>
                                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Total Appeals Logged</div>
                                                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                        {totalAppeals}
                                                    </div>
                                                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-semibold">
                                                        {appealsData?.pending_count || 0} Pending Review
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Resolution Efficiency</div>
                                                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                                                        {resolutionRate}%
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        {appealsData?.approved_count || 0} approved / {appealsData?.rejected_count || 0} rejected
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">7D Inflow Forecast</div>
                                                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                        {appeals7dProjected}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        Projected appeals next week
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Forecasting Model</div>
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                                                        {appealsData?.model_used || "AutoTheta Forecaster"}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        Confidence: {appealsData?.confidence || "85%"}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 space-y-2">
                                                <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-2">
                                                    <i className="fas fa-scale-balanced text-purple-500"></i>
                                                    Appeals Remediation &amp; Governance Insight
                                                </div>
                                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {appealsData?.explanation || "Tracks lockouts appealed by users and models unblock queue turnaround efficiency, predicting incoming appeal volume to assist administrator triage."}
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    {/* Expenses Inspection */}
                                    {activeChartModal.type === 'expense' && (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Next Month Projected Outlay</div>
                                                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                        ₱{forecastData.expense_next_month.prediction.toLocaleString()}
                                                    </div>
                                                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                                                        90% Confidence Boundary
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Algorithm Used</div>
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                                                        {forecastData.expense_next_month.model_used || "AutoTheta Forecaster"}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        Rust/WASM Engine
                                                    </div>
                                                </div>
                                                <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estimated Outlay Range</div>
                                                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                                                        ₱{forecastData.expense_next_month.confidence_interval.lower.toLocaleString()} - ₱{forecastData.expense_next_month.confidence_interval.upper.toLocaleString()}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        Based on paid PO history
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 space-y-2">
                                                <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                                    <i className="fas fa-lightbulb text-amber-500"></i>
                                                    How Did the System Compute This?
                                                </div>
                                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {forecastData.expense_next_month.explanation || "Aggregates total expenditures strictly from paid purchase orders with status 'Confirmed' or 'Delivered' in Supabase, utilizing AutoTheta time-series forecasting."}
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                                    <i className="fas fa-history text-emerald-500"></i>
                                                    Historical Outlay vs Forecasted Budget
                                                </h4>
                                                <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                                                            <tr>
                                                                <th className="py-2.5 px-4">Period</th>
                                                                <th className="py-2.5 px-4">Type</th>
                                                                <th className="py-2.5 px-4 text-right">Expenditure Amount (₱)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                                                            {forecastData.expense_next_month.historical.months.map((monthStr, idx) => {
                                                                const amt = forecastData.expense_next_month.historical.amounts[idx] || 0;
                                                                return (
                                                                    <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition">
                                                                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{monthStr}</td>
                                                                        <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                                                                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                                                                                Actual Paid
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                            ₱{amt.toLocaleString()}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr className="bg-emerald-50/40 dark:bg-emerald-950/20 font-bold">
                                                                <td className="py-3 px-4 text-emerald-700 dark:text-emerald-300">Next Month (Projected)</td>
                                                                <td className="py-3 px-4">
                                                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-bold text-[10px]">
                                                                        WASM Forecast
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-4 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                                                                    ₱{forecastData.expense_next_month.prediction.toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Couriers Inspection */}
                                    {activeChartModal.type === 'couriers' && (
                                        <>
                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 space-y-2">
                                                <div className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-2">
                                                    <i className="fas fa-truck text-pink-500"></i>
                                                    Carrier Network Distribution
                                                </div>
                                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Calculated from direct parcel records in the database. Courier share metrics indicate operational dependence on shipping partners and guide warehouse staging.
                                                </p>
                                            </div>

                                            <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                                                        <tr>
                                                            <th className="py-2.5 px-4">Rank</th>
                                                            <th className="py-2.5 px-4">Courier Partner</th>
                                                            <th className="py-2.5 px-4 text-center">Dispatched Parcels</th>
                                                            <th className="py-2.5 px-4 text-right">Volume Share</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                                                        {sortedCouriers.map(([name, count], idx) => {
                                                            const pct = totalDbParcels > 0 ? ((count / totalDbParcels) * 100).toFixed(1) : '0';
                                                            return (
                                                                <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition">
                                                                    <td className="py-2.5 px-4 font-bold text-slate-700 dark:text-slate-300">#{idx + 1}</td>
                                                                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                                                        <i className="fas fa-truck text-slate-400"></i>
                                                                        <span>{name}</span>
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-center font-mono font-semibold">{count.toLocaleString()}</td>
                                                                    <td className="py-2.5 px-4 text-right font-mono font-bold text-pink-600 dark:text-pink-400">{pct}%</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between shrink-0">
                                    <div className="text-xs text-slate-400">
                                        <i className="fas fa-microchip text-pink-500 mr-1"></i>
                                        Powered by @sipemu/anofox-forecast (Rust/WASM)
                                    </div>
                                    <AppButton type="button" variant="primary" size="sm" onClick={() => setActiveChartModal(prev => ({ ...prev, isOpen: false }))}>
                                        Close Inspection
                                    </AppButton>
                                </div>
                            </div>
                        </div>
                    </Portal>
                )}

                {/* AI Modal */}
                {isAiModalOpen && (
                    <Portal>
                        <div
                            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) setIsAiModalOpen(false);
                            }}
                        >
                            <div className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl border border-white/80 dark:border-[#2c2d3c] max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden" data-lenis-prevent>
                                <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-pink-500 to-pink-600 text-white flex items-center justify-center text-lg">
                                            <i className="fas fa-brain"></i>
                                        </div>
                                        <div>
                                            <h2 className="text-base font-bold text-slate-900 dark:text-white">AI Forecasting &amp; Operational Interpretation</h2>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Deep analysis of parcel volume, workforce concurrency, blocked device threats, and appeals</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <AppButton
                                            type="button"
                                            variant="neutral"
                                            size="xs"
                                            onClick={() => {
                                                setIsAiModalOpen(false);
                                                setIsAiMinimized(true);
                                            }}
                                            title="Minimize to compact bar"
                                        >
                                            <i className="fas fa-minus text-[10px]"></i>
                                            <span>Minimize</span>
                                        </AppButton>
                                        <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => setIsAiModalOpen(false)} aria-label="Close modal">
                                            <i className="fas fa-times text-xs"></i>
                                        </AppButton>
                                    </div>
                                </div>

                                <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1 overscroll-contain" data-lenis-prevent>
                                    {summarizing ? (
                                        <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                                            <div className="w-14 h-14 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-pink-500 dark:text-pink-400 flex items-center justify-center text-xl">
                                                <i className="fas fa-wand-magic-sparkles fa-spin"></i>
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Synthesizing Models with Gemini AI...</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                                                Evaluating 6-month historical counts, workforce concurrency, blocked device threat risks, and unblock appeals.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {parseAiSummarySections(aiSummary).map((section, idx) => (
                                                <div key={idx} className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 space-y-2">
                                                    {section.title && (
                                                        <div className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-pink-600 shrink-0"></span>
                                                            {section.title}
                                                        </div>
                                                    )}
                                                    <div className={`text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed ${section.title ? 'pl-3.5 border-l-2 border-pink-500' : ''}`}>
                                                        {section.content}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between shrink-0">
                                    <div className="text-xs text-slate-400">
                                        <i className="fas fa-shield-halved text-pink-500 mr-1"></i>
                                        Grounded strictly in active Supabase records
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <AppButton type="button" variant="neutral" size="sm" onClick={generateAiSummary} disabled={summarizing}>
                                            <i className={`fas fa-rotate text-xs ${summarizing ? 'fa-spin' : ''}`}></i>
                                            <span>Regenerate</span>
                                        </AppButton>
                                        <AppButton type="button" variant="primary" size="sm" onClick={() => setIsAiModalOpen(false)}>
                                            Done
                                        </AppButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Portal>
                )}

                {/* Forecast Export Selection Modal */}
                <ForecastExportModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    forecastData={forecastData as any}
                    chartCanvases={{
                        parcelChart: parcelChartRef.current,
                        expenseChart: expenseChartRef.current,
                        courierChart: courierPieRef.current,
                    }}
                />
            </div>
        </SessionGuard>
    );
}
