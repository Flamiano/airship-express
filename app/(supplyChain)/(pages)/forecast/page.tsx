// app/(supplyChain)/(pages)/forecast/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Chart from "chart.js/auto";
import { SessionGuard } from "../../components/server/SessionGuard";
import Cards from "../../components/global/Cards";
import { CardsSkeleton } from "../../components/ui/SkeletonLoader";
import { AppButton } from "../../components/ui/AppButton";
import { StatusBadge, type BadgeTone } from "../../components/ui/StatusBadge";
import { toast } from "sonner";
import ForecastExportModal from "./components/ForecastExportModal";
import ItemForecastModal from "./components/ItemForecastModal";
import ItemHistoryModal from "./components/ItemHistoryModal";
import ForecastChartDetailsModal, { type ForecastChartDomain } from "./components/ForecastChartDetailsModal";
import ItemMovementSection, { type ItemMovementAnalyticsData } from "./components/ItemMovementSection";
import ForecastAiSummaryPanel from "./components/ForecastAiSummaryPanel";

interface ForecastSummary {
    total_items: number;
    items_forecasted: number;
    has_sufficient_data: boolean;
    has_three_years_history?: boolean;
    is_prediction_valid?: boolean;
    history_span_days?: number;
    required_history_days?: number;
    earliest_record_date?: string | null;
    total_predicted_demand: number;
    primary_units_breakdown: Record<string, number>;
    potential_shortages: number;
    critical_count: number;
    low_stock_count: number;
    normal_count: number;
    average_accuracy: number | null;
    average_mae: number | null;
    accuracy_label: string;
    prediction_status?: string;
    prediction_message?: string;
}

interface ForecastItem {
    id: string | number;
    item_code: string;
    item_name: string;
    category: string;
    unit: string;
    current_stock: number;
    exporting_stock: number;
    available_stock: number;
    minimum_stock: number;
    purchase_price: number;
    supplier: string;

    is_prediction_valid?: boolean;
    prediction_message?: string;

    total_consumed_period: number;
    consumption_events_count: number;
    average_daily_consumption: number;
    zero_days_fraction: number;
    demand_trend: "Increasing" | "Decreasing" | "Stable" | "Insufficient Data";
    trend_percentage: number;

    forecast_demand: number;
    daily_predictions: number[];
    prediction_dates: string[];
    lower_bounds: number[];
    upper_bounds: number[];
    confidence: string;
    model_used: string;

    expected_incoming: number;
    incoming_pos_details: {
        po_number: string;
        delivery_date: string;
        quantity: number;
    }[];

    projected_stock: number;
    risk_level: "Critical" | "Low Stock Risk" | "Normal";
    recommended_action: string;
    evaluation?: {
        has_evaluation: boolean;
        mae: number;
        rmse: number;
        wape: number;
        accuracy_percentage: number;
        actual_holdout_sum: number;
        forecast_holdout_sum: number;
        model_tested: string;
    } | null;
}

interface ConsumptionAnalysis {
    dates: string[];
    daily_totals: number[];
    weekly_labels: string[];
    weekly_totals: number[];
    monthly_labels: string[];
    monthly_totals: number[];
    department_breakdown: { department: string; count: number; total_quantity: number }[];
    top_consumed_items: { item_code: string; item_name: string; unit: string; total_quantity: number; events: number }[];
    increasing_items: { item_code: string; item_name: string; growth: number }[];
    decreasing_items: { item_code: string; item_name: string; decline: number }[];
    unmet_requests_summary: {
        total_pending_qty: number;
        pending_requests_count: number;
        items_with_pending: number;
    };
}

interface ForecastApiResponse {
    success: boolean;
    timestamp: string;
    historical_period_days: number;
    horizon_days: number;
    summary: ForecastSummary;
    chart_timeline: {
        historical_dates: string[];
        historical_demands: number[];
        forecast_dates: string[];
        forecast_demands: number[];
        forecast_lower: number[];
        forecast_upper: number[];
    };
    items: ForecastItem[];
    item_movement_analytics?: ItemMovementAnalyticsData;
    consumption_analysis: ConsumptionAnalysis;
    ai_insights: {
        summary: string;
        critical_shortages: string[];
        trend_observations: string[];
        procurement_actions: string[];
        uncertainty_notes: string[];
    };
    persistence_info: {
        is_persisted: boolean;
        message: string;
        required_schema?: string;
    };
    error?: string;
}

export type ForecastTabId = "dashboard" | "table" | "consumption" | "movement";

const parseTabParam = (param: string | null): ForecastTabId => {
    if (!param) return "dashboard";
    const normalized = param.toLowerCase().trim();
    if (normalized === "dashboard" || normalized === "chart" || normalized === "visualizer" || normalized === "overview") return "dashboard";
    if (normalized === "table" || normalized === "items" || normalized === "predictions" || normalized === "stock") return "table";
    if (normalized === "consumption" || normalized === "usage" || normalized === "history-consumption") return "consumption";
    if (normalized === "movement" || normalized === "velocity" || normalized === "items-movement") return "movement";
    return "dashboard";
};

function ForecastContent() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    // 1. Controls State
    const [periodDays, setPeriodDays] = useState<number>(30);
    const [horizonDays, setHorizonDays] = useState<number>(7);
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [riskFilter, setRiskFilter] = useState<string>("all");

    // 2. Data State
    const [forecastData, setForecastData] = useState<ForecastApiResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<ForecastTabId>(() =>
        parseTabParam(searchParams.get("tab"))
    );
    const [consumptionView, setConsumptionView] = useState<"daily" | "weekly" | "monthly">("daily");
    const [selectedChartItem, setSelectedChartItem] = useState<string>("all");
    const [customDateRange, setCustomDateRange] = useState<{ from: string; to: string } | null>(null);

    // Sync tab when searchParams change in the URL
    useEffect(() => {
        const tabFromUrl = parseTabParam(searchParams.get("tab"));
        setActiveTab(tabFromUrl);
    }, [searchParams]);

    // Handle tab change and synchronize URL
    const handleTabChange = useCallback((newTab: ForecastTabId) => {
        setActiveTab(newTab);
        try {
            const currentParams = new URLSearchParams(searchParams.toString());
            currentParams.set("tab", newTab);
            window.history.replaceState(null, "", `${pathname}?${currentParams.toString()}`);
        } catch {
            // fallback
        }
    }, [pathname, searchParams]);

    // 3. Modals State
    const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
    const [detailModalItem, setDetailModalItem] = useState<ForecastItem | null>(null);
    const [historyModalItem, setHistoryModalItem] = useState<ForecastItem | null>(null);
    const [chartModalDomain, setChartModalDomain] = useState<ForecastChartDomain | null>(null);

    // 4. Chart References
    const demandChartRef = useRef<HTMLCanvasElement | null>(null);
    const demandChartInstance = useRef<Chart | null>(null);
    const consumptionChartRef = useRef<HTMLCanvasElement | null>(null);
    const consumptionChartInstance = useRef<Chart | null>(null);

    // Fetch Forecast Data
    const fetchForecast = useCallback(async (isManualRefresh = false) => {
        if (isManualRefresh) setIsRefreshing(true);
        else setLoading(true);

        try {
            const params = new URLSearchParams({
                period: String(periodDays),
                horizon: String(horizonDays),
                category: categoryFilter,
                search: searchQuery,
                risk: riskFilter
            });

            if (customDateRange?.from && customDateRange?.to) {
                params.set("startDate", customDateRange.from);
                params.set("endDate", customDateRange.to);
            }

            const res = await fetch(`/forecast/api?${params.toString()}`);
            const data: ForecastApiResponse = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to fetch demand forecast");
            }

            setForecastData(data);

            if (isManualRefresh) {
                toast.success("Demand forecast refreshed with current inventory & movement logs!");
            }
        } catch (err: any) {
            console.error("Forecast fetch error:", err);
            toast.error(err?.message || "Error loading demand forecast data");
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [periodDays, horizonDays, categoryFilter, searchQuery, riskFilter, customDateRange]);

    useEffect(() => {
        fetchForecast(false);
    }, [fetchForecast]);

    // Categories list dynamically derived from all items
    const availableCategories = useMemo(() => {
        if (!forecastData?.items) return [];
        const cats = new Set<string>();
        forecastData.items.forEach((i) => {
            if (i.category) cats.add(i.category);
        });
        return Array.from(cats).sort();
    }, [forecastData?.items]);

    // Filtered items list for Table
    const displayItems = useMemo(() => {
        if (!forecastData?.items) return [];
        let items = [...forecastData.items];

        if (categoryFilter !== "all") {
            items = items.filter((i) => i.category.toLowerCase() === categoryFilter.toLowerCase());
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            items = items.filter(
                (i) => i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q)
            );
        }

        if (riskFilter !== "all") {
            if (riskFilter === "critical") {
                items = items.filter((i) => i.risk_level === "Critical");
            } else if (riskFilter === "low_stock") {
                items = items.filter((i) => i.risk_level === "Low Stock Risk");
            } else if (riskFilter === "normal") {
                items = items.filter((i) => i.risk_level === "Normal");
            }
        }

        return items;
    }, [forecastData?.items, categoryFilter, searchQuery, riskFilter]);

    // 5. Theme change detection for high-contrast chart rendering
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

    useEffect(() => {
        const checkDark = () => {
            if (typeof document !== "undefined") {
                setIsDarkMode(document.documentElement.classList.contains("dark"));
            }
        };
        checkDark();
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    // 6. Render Demand Forecast Chart (Historical Actuals + Future Forecast with Bounds)
    useEffect(() => {
        if (activeTab !== "dashboard" || !forecastData || loading) return;

        const timer = setTimeout(() => {
            const canvas = demandChartRef.current;
            if (!canvas) return;

            if (demandChartInstance.current) {
                demandChartInstance.current.destroy();
                demandChartInstance.current = null;
            }
            const existing = Chart.getChart(canvas);
            if (existing) {
                existing.destroy();
            }

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
            const textColor = isDark ? "#e2e8f0" : "#1e293b";
            const mutedColor = isDark ? "#94a3b8" : "#64748b";
            const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(166, 175, 195, 0.2)";

            let histDates = forecastData.chart_timeline?.historical_dates || [];
            let histValues = forecastData.chart_timeline?.historical_demands || [];
            let fcDates = forecastData.chart_timeline?.forecast_dates || [];
            let fcValues = forecastData.chart_timeline?.forecast_demands || [];
            let fcLower = forecastData.chart_timeline?.forecast_lower || [];
            let fcUpper = forecastData.chart_timeline?.forecast_upper || [];
            let itemLabel = "Aggregate Inventory Demand";
            let unitLabel = "units";

            // If a specific item is selected from the dropdown
            if (selectedChartItem !== "all") {
                const item = forecastData.items?.find((i) => String(i.id) === selectedChartItem || i.item_code === selectedChartItem);
                if (item) {
                    itemLabel = `${item.item_name} (${item.item_code})`;
                    unitLabel = item.unit || "units";
                    fcValues = item.daily_predictions || [];
                    fcLower = item.lower_bounds || [];
                    fcUpper = item.upper_bounds || [];
                }
            }

            // Downsample historical dates if long window (> 60 days) for clean x-axis readability
            const displayLabels = [
                ...histDates.map((d) => d.slice(5)),
                ...fcDates.map((d) => `${d.slice(5)} (Fc)`)
            ];

            // Pad historical values with nulls for the forecast window
            const historicalDataset = [...histValues, ...Array(fcDates.length).fill(null)];

            const isInvalidHistory = summary?.has_three_years_history === false;

            // Connect the forecast line starting from the last historical point
            const lastHistVal = histValues.length > 0 ? histValues[histValues.length - 1] : 0;
            const forecastDataset = isInvalidHistory
                ? [
                    ...Array(Math.max(0, histValues.length - 1)).fill(null),
                    0,
                    ...Array(fcDates.length).fill(0)
                ]
                : [
                    ...Array(Math.max(0, histValues.length - 1)).fill(null),
                    lastHistVal,
                    ...fcValues
                ];
            const lowerDataset = isInvalidHistory
                ? Array(displayLabels.length).fill(null)
                : [
                    ...Array(Math.max(0, histValues.length - 1)).fill(null),
                    lastHistVal,
                    ...fcLower
                ];
            const upperDataset = isInvalidHistory
                ? Array(displayLabels.length).fill(null)
                : [
                    ...Array(Math.max(0, histValues.length - 1)).fill(null),
                    lastHistVal,
                    ...fcUpper
                ];

            const forecastLineLabel = isInvalidHistory
                ? "No Prediction (0% Confidence — Data < 3 Years)"
                : (selectedChartItem === "all" ? "Forecasted Future Demand" : `Forecast: ${itemLabel}`);

            demandChartInstance.current = new Chart(ctx, {
                type: "line",
                data: {
                    labels: displayLabels,
                    datasets: [
                        {
                            label: "Historical Actual Demand",
                            data: historicalDataset,
                            borderColor: "#3b82f6",
                            backgroundColor: "rgba(59, 130, 246, 0.08)",
                            borderWidth: 2.5,
                            pointRadius: 2,
                            pointHoverRadius: 5,
                            pointBackgroundColor: "#3b82f6",
                            tension: 0.25,
                            fill: true
                        },
                        {
                            label: "Upper Confidence Bound",
                            data: upperDataset,
                            borderColor: "transparent",
                            backgroundColor: isInvalidHistory ? "transparent" : "rgba(236, 72, 153, 0.12)",
                            pointRadius: 0,
                            fill: "+1",
                            tension: 0.3
                        },
                        {
                            label: "Lower Confidence Bound",
                            data: lowerDataset,
                            borderColor: "transparent",
                            backgroundColor: "transparent",
                            pointRadius: 0,
                            fill: false,
                            tension: 0.3
                        },
                        {
                            label: forecastLineLabel,
                            data: forecastDataset,
                            borderColor: isInvalidHistory ? "#94a3b8" : "#ec4899",
                            backgroundColor: isInvalidHistory ? "transparent" : "rgba(236, 72, 153, 0.18)",
                            borderWidth: 2.5,
                            borderDash: [5, 4],
                            pointRadius: isInvalidHistory ? 0 : 3,
                            pointHoverRadius: isInvalidHistory ? 2 : 6,
                            pointBackgroundColor: isInvalidHistory ? "#94a3b8" : "#ec4899",
                            tension: 0.3,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: "index",
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            position: "top",
                            labels: {
                                color: textColor,
                                font: { size: 11, weight: "bold" },
                                boxWidth: 12,
                                padding: 14,
                                filter: (legendItem) => {
                                    return (
                                        legendItem.text !== "Upper Confidence Bound" &&
                                        legendItem.text !== "Lower Confidence Bound"
                                    );
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    if (ctx.raw === null || ctx.raw === undefined) return "";
                                    const val = ctx.raw as number;
                                    const dsLabel = ctx.dataset.label || "";
                                    if (dsLabel.includes("Upper Confidence") || dsLabel.includes("Lower Confidence")) return `${dsLabel}: ${val}`;
                                    if (dsLabel.includes("No Prediction")) return `${dsLabel}: 0 ${unitLabel} (Insufficient 3-year records)`;
                                    return `${dsLabel}: ${val} ${unitLabel}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: mutedColor,
                                font: { size: 10, weight: "bold" },
                                maxRotation: 45,
                                autoSkip: true,
                                maxTicksLimit: 14
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: {
                                color: mutedColor,
                                font: { size: 10, weight: "bold" },
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }, 40);

        return () => {
            clearTimeout(timer);
            if (demandChartInstance.current) {
                demandChartInstance.current.destroy();
                demandChartInstance.current = null;
            }
            if (demandChartRef.current) {
                const existing = Chart.getChart(demandChartRef.current);
                if (existing) existing.destroy();
            }
        };
    }, [forecastData, loading, selectedChartItem, activeTab, isDarkMode]);

    // 7. Render Consumption Overview Chart
    useEffect(() => {
        if (activeTab !== "consumption" || !forecastData || loading) return;

        const timer = setTimeout(() => {
            const canvas = consumptionChartRef.current;
            if (!canvas) return;

            if (consumptionChartInstance.current) {
                consumptionChartInstance.current.destroy();
                consumptionChartInstance.current = null;
            }
            const existing = Chart.getChart(canvas);
            if (existing) {
                existing.destroy();
            }

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
            const mutedColor = isDark ? "#94a3b8" : "#64748b";
            const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(166, 175, 195, 0.2)";

            const analysis = forecastData.consumption_analysis;
            let labels = analysis?.dates?.map((d) => d.slice(5)) || [];
            let dataValues = analysis?.daily_totals || [];

            if (consumptionView === "weekly") {
                labels = analysis?.weekly_labels || [];
                dataValues = analysis?.weekly_totals || [];
            } else if (consumptionView === "monthly") {
                labels = analysis?.monthly_labels || [];
                dataValues = analysis?.monthly_totals || [];
            }

            consumptionChartInstance.current = new Chart(ctx, {
                type: "bar",
                data: {
                    labels,
                    datasets: [
                        {
                            label: `${consumptionView.toUpperCase()} Consumption Issuances`,
                            data: dataValues,
                            backgroundColor: "rgba(99, 102, 241, 0.65)",
                            borderColor: "#6366f1",
                            borderWidth: 1.5,
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `Issued Volume: ${ctx.parsed.y} units`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: mutedColor,
                                font: { size: 10, weight: "bold" },
                                autoSkip: true,
                                maxTicksLimit: 12
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: {
                                color: mutedColor,
                                font: { size: 10, weight: "bold" }
                            }
                        }
                    }
                }
            });
        }, 40);

        return () => {
            clearTimeout(timer);
            if (consumptionChartInstance.current) {
                consumptionChartInstance.current.destroy();
                consumptionChartInstance.current = null;
            }
            if (consumptionChartRef.current) {
                const existing = Chart.getChart(consumptionChartRef.current);
                if (existing) existing.destroy();
            }
        };
    }, [forecastData, loading, consumptionView, activeTab, isDarkMode]);

    const summary = forecastData?.summary;
    const ai = forecastData?.ai_insights;

    // Unit breakdown string
    const unitsSummaryStr = useMemo(() => {
        if (!summary?.primary_units_breakdown) return "";
        return Object.entries(summary.primary_units_breakdown)
            .map(([unit, qty]) => `${qty} ${unit}`)
            .join(", ");
    }, [summary?.primary_units_breakdown]);

    return (
        <SessionGuard>
            <div className="min-h-screen bg-[#ebf0f7] dark:bg-[#14151c] text-slate-800 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 bgCard">
                {/* 1. Header & Quick Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800/80">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 shrink-0">
                                <i className="fas fa-boxes-stacked text-xl" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                    Inventory Demand Forecast
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Predict future stock demand based on previous usage and incoming orders
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => {
                                const el = document.getElementById('forecast-ai-summary-panel');
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.classList.add('ring-2', 'ring-pink-500', 'ring-offset-2');
                                    setTimeout(() => {
                                        el.classList.remove('ring-2', 'ring-pink-500', 'ring-offset-2');
                                    }, 2000);
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-pink-500 hover:bg-pink-600 transition-all cursor-pointer active:scale-95"
                            title="Jump to AI Forecast Summary"
                        >
                            <i className="fas fa-wand-magic-sparkles text-xs" />
                            <span>AI Summary</span>
                        </button>

                        <AppButton
                            type="button"
                            variant="neutral"
                            size="sm"
                            onClick={() => setIsExportModalOpen(true)}
                            disabled={loading || !forecastData}
                        >
                            <i className="fas fa-file-export text-xs mr-1.5" />
                            Export Report
                        </AppButton>

                        <AppButton
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => fetchForecast(true)}
                            disabled={isRefreshing}
                        >
                            <i className={`fas fa-rotate text-xs mr-1.5 ${isRefreshing ? "fa-spin" : ""}`} />
                            Refresh Forecast
                        </AppButton>
                    </div>
                </div>

                {/* 2. Forecast Controls Toolbar (Neumorphic Card & Inset Inputs) */}
                <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 text-[11px]">
                                <i className="fas fa-sliders" />
                            </span>
                            Forecast Settings &amp; Filters
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                            <i className="fas fa-shield-check text-xs text-slate-400" />
                            Calculated from recorded inventory usage
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                        {/* Control 1: Historical Period */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                Past Usage Days
                            </label>
                            <select
                                value={periodDays}
                                onChange={(e) => setPeriodDays(Number(e.target.value))}
                                className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer transition-all"
                            >
                                <option value={30}>Past 30 Days (1 Month)</option>
                                <option value={90}>Past 90 Days (Quarterly)</option>
                                <option value={180}>Past 6 Months</option>
                                <option value={210}>Past 7 Months</option>
                            </select>
                        </div>

                        {/* Control 2: Forecast Horizon */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                Forecast Next
                            </label>
                            <select
                                value={horizonDays}
                                onChange={(e) => setHorizonDays(Number(e.target.value))}
                                className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer transition-all"
                            >
                                <option value={7}>Next 7 Days (1 Week)</option>
                                <option value={14}>Next 14 Days (2 Weeks)</option>
                                <option value={30}>Next 30 Days (1 Month)</option>
                            </select>
                        </div>

                        {/* Control 3: Category Filter */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                Item Category
                            </label>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer transition-all"
                            >
                                <option value="all">All Categories</option>
                                {availableCategories.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Control 4: Risk Filter */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                Stock Status
                            </label>
                            <select
                                value={riskFilter}
                                onChange={(e) => setRiskFilter(e.target.value)}
                                className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer transition-all"
                            >
                                <option value="all">All Stock Statuses</option>
                                <option value="critical">Critical Risk (Will Run Out)</option>
                                <option value="low_stock">Low Stock (Below Buffer)</option>
                                <option value="normal">Normal (Healthy Stock)</option>
                            </select>
                        </div>

                        {/* Control 5: Search Filter */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                Search Items
                            </label>
                            <div className="relative group">
                                <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 group-focus-within:text-pink-500 transition-colors pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name or code..."
                                    className="w-full text-xs font-semibold pl-9 pr-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Dashboard KPI Overview Cards */}
                {loading ? (
                    <CardsSkeleton />
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Card 1: Items Tracked */}
                        <Cards
                            frontIcon="fas fa-boxes-stacked"
                            header="Items Tracked"
                            data={summary?.has_three_years_history === false ? "0" : String(summary?.items_forecasted || 0)}
                            description={
                                summary?.has_three_years_history === false
                                    ? `System records span ${summary?.history_span_days || 0} days (requires 3+ years for forecasting)`
                                    : summary?.has_sufficient_data
                                    ? `${summary?.items_forecasted || 0} of ${summary?.total_items || 0} items have usage records`
                                    : "No usage history found in selected period"
                            }
                            badge={summary?.has_three_years_history === false ? "Needs 3+ Yrs Data" : `${summary?.items_forecasted || 0}/${summary?.total_items || 0} Items`}
                            arrow="fas fa-layer-group"
                            backBg="bg-blue-900"
                            backHeader="Data Requirement"
                            backDescription="At least 3 years of recorded stock history is needed to create reliable forecasts."
                        />

                        {/* Card 2: Expected Demand */}
                        <Cards
                            frontIcon="fas fa-chart-line-up"
                            header="Expected Demand"
                            data={summary?.has_three_years_history === false ? "0 units" : String(summary?.total_predicted_demand || 0)}
                            description={
                                summary?.has_three_years_history === false
                                    ? "Forecasts are paused until 3 years of usage data is recorded"
                                    : unitsSummaryStr
                                    ? `Total estimated demand: ${unitsSummaryStr}`
                                    : `Total predicted items needed over next ${horizonDays} days`
                            }
                            badge={summary?.has_three_years_history === false ? "No Forecast" : `${horizonDays}-Day Period`}
                            arrow="fas fa-arrow-trend-up"
                            backBg="bg-pink-900"
                            backHeader="Demand Calculation"
                            backDescription="Estimates future stock needed based on how quickly items were used in the past."
                        />

                        {/* Card 3: Low Stock Alerts */}
                        <Cards
                            frontIcon="fas fa-triangle-exclamation text-rose-500"
                            header="Low Stock Alerts"
                            data={String(summary?.potential_shortages || 0)}
                            description={`${summary?.critical_count || 0} items at risk of running out, ${summary?.low_stock_count || 0} near buffer`}
                            badge={summary?.potential_shortages ? "Action Needed" : "Stock Healthy"}
                            arrow="fas fa-exclamation"
                            backBg="bg-rose-950"
                            backHeader="Low Stock Warning"
                            backDescription="Items that will drop below minimum stock levels before incoming orders arrive."
                        />

                        {/* Card 4: Forecast Accuracy */}
                        <Cards
                            frontIcon="fas fa-bullseye text-emerald-500"
                            header="Forecast Accuracy"
                            data={summary?.has_three_years_history === false ? "0%" : (summary?.average_accuracy !== null ? `${summary?.average_accuracy}%` : "Evaluating")}
                            description={summary?.has_three_years_history === false ? "Requires 3-year baseline data" : (summary?.accuracy_label || "Tested against past usage")}
                            badge={summary?.has_three_years_history === false ? "Needs Data" : (summary?.average_mae !== null ? `Error: ±${summary?.average_mae}` : "Accuracy Score")}
                            arrow="fas fa-check-double"
                            backBg="bg-emerald-950"
                            backHeader="Accuracy Testing"
                            backDescription="Measures how closely predictions matched actual historical stock usage."
                        />
                    </div>
                )}

                {/* 4. Forecast AI Intelligence & Multi-Tab Summary Matrix Panel */}
                {forecastData && !loading && (
                    <ForecastAiSummaryPanel
                        forecastData={forecastData}
                        activeTab={activeTab}
                        onSelectTab={(tab) => handleTabChange(tab as ForecastTabId)}
                        onOpenChartModal={(domain) => setChartModalDomain(domain as ForecastChartDomain)}
                    />
                )}

                {/* 5. Navigation Tabs */}
                <div className="w-full flex flex-wrap items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-1.5 bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] max-w-full overflow-x-auto no-scrollbar">
                        <button
                            type="button"
                            onClick={() => handleTabChange("dashboard")}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0 select-none ${
                                activeTab === "dashboard"
                                    ? "bg-pink-500 text-white font-bold"
                                    : "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533]"
                            }`}
                        >
                            <i className="fas fa-chart-line text-xs" />
                            <span>Overview Chart</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleTabChange("table")}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0 select-none ${
                                activeTab === "table"
                                    ? "bg-pink-500 text-white font-bold"
                                    : "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533]"
                            }`}
                        >
                            <i className="fas fa-table-list text-xs" />
                            <span>Item Predictions</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono ${
                                activeTab === "table" ? "bg-white text-pink-600 shadow-xs" : "bg-pink-500 text-white"
                            }`}>
                                {displayItems.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleTabChange("consumption")}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0 select-none ${
                                activeTab === "consumption"
                                    ? "bg-pink-500 text-white font-bold"
                                    : "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533]"
                            }`}
                        >
                            <i className="fas fa-dolly text-xs" />
                            <span>Usage History</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleTabChange("movement")}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0 select-none ${
                                activeTab === "movement"
                                    ? "bg-pink-500 text-white font-bold"
                                    : "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533]"
                            }`}
                        >
                            <i className="fas fa-arrows-up-down text-xs" />
                            <span>Stock Movement</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold font-mono ${
                                activeTab === "movement" ? "bg-white text-pink-600 shadow-xs" : "bg-pink-500 text-white"
                            }`}>
                                {(forecastData?.item_movement_analytics?.active_moving_items_count ?? 0) + (forecastData?.item_movement_analytics?.zero_issuance_items_count ?? 0)}
                            </span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            const el = document.getElementById('forecast-ai-summary-panel');
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('ring-2', 'ring-pink-500', 'ring-offset-2');
                                setTimeout(() => {
                                    el.classList.remove('ring-2', 'ring-pink-500', 'ring-offset-2');
                                }, 2000);
                            }
                        }}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] hover:text-pink-700 transition-colors cursor-pointer"
                        title="Jump to Smart Forecast Summary"
                    >
                        <i className="fas fa-wand-magic-sparkles text-xs" />
                        <span>AI Summary</span>
                    </button>
                </div>

                {/* TAB 1: Demand Forecast Time-Series Chart */}
                {activeTab === "dashboard" && (
                    <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 text-[11px]">
                                        <i className="fas fa-chart-spline" />
                                    </span>
                                    Demand Forecast Overview (Past Usage vs Predicted Demand)
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Compare recorded past stock usage with expected future demand
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Inspect Item:</label>
                                <select
                                    value={selectedChartItem}
                                    onChange={(e) => setSelectedChartItem(e.target.value)}
                                    className="text-xs font-semibold px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer"
                                >
                                    <option value="all">All Items (Total Demand)</option>
                                    {forecastData?.items?.map((item) => (
                                        <option key={item.id} value={String(item.id)}>
                                            {item.item_name} ({item.item_code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 3-Year Historical Safeguard Banner */}
                        {summary?.has_three_years_history === false && (
                            <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/[0.08] border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                    <i className="fas fa-triangle-exclamation text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                            More Usage Data Needed for Predictions
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                                            Current Records: {summary.history_span_days || 0} / 1,095 Days (Requires 3+ Years)
                                        </span>
                                    </div>
                                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                                        Reliable forecasting requires at least <b>3 years (1,095 days)</b> of usage records. Because your system currently has <b>{summary.history_span_days || 0} days</b> recorded, future projections are kept at 0 to avoid inaccurate guesses. You can view your real past usage (blue line) below.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Debossed Inset Chart Canvas Well */}
                        <div
                            onClick={() => setChartModalDomain("dashboard")}
                            className="p-4 sm:p-5 rounded-2xl bg-[#ebf0f7]/70 dark:bg-[#12131b]/80 border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] cursor-pointer group relative"
                        >
                            {/* Hover Inspector Hint */}
                            <div className="absolute top-3 right-3 z-10 opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-pink-600 dark:text-pink-400 bg-white/90 dark:bg-black/70 border border-pink-500/30 flex items-center gap-1.5">
                                    <i className="fas fa-expand text-[9px]" />
                                    <span>Inspect Details</span>
                                </span>
                            </div>
                            {loading ? (
                                <div className="h-72 sm:h-80 w-full flex flex-col items-center justify-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 animate-spin">
                                        <i className="fas fa-circle-notch text-base" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        Loading demand overview chart...
                                    </span>
                                </div>
                            ) : (
                                <div className="h-72 sm:h-80 w-full relative">
                                    <canvas ref={demandChartRef} className="w-full h-full block" />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/60 dark:border-slate-800 pt-3">
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <span className="w-3 h-0.5 bg-blue-500 rounded-full" />
                                    Past Stock Usage
                                </span>
                                {summary?.has_three_years_history === false ? (
                                    <span className="flex items-center gap-1.5 font-medium text-slate-500 font-semibold">
                                        <span className="w-3 h-0.5 bg-slate-400 border-b border-dashed border-slate-400" />
                                        No Prediction (Needs 3+ Years Data)
                                    </span>
                                ) : (
                                    <>
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <span className="w-3 h-0.5 bg-pink-500 border-b border-dashed border-pink-500" />
                                            Predicted Future Demand
                                        </span>
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <span className="w-3 h-3 bg-pink-500/20 rounded-xs" />
                                            Expected Range (85%-90%)
                                        </span>
                                    </>
                                )}
                            </div>
                            <span className="font-mono text-[10px]">
                                {summary?.has_three_years_history === false ? "Status: Needs 3-Year Usage Records" : "Forecast Models: Pattern Analysis & Seasonality"}
                            </span>
                        </div>
                    </div>
                )}

                {/* TAB 2: Predicted Demand Table */}
                {activeTab === "table" && (
                    <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 text-[11px]">
                                        <i className="fas fa-table-list" />
                                    </span>
                                    Item Predictions &amp; Stock Health
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Projected Stock = In Stock + Incoming Orders - Expected Demand
                                </p>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] text-slate-500">
                                Showing {displayItems.length} items
                            </span>
                        </div>

                        {/* 3-Year Historical Safeguard Banner in Table */}
                        {summary?.has_three_years_history === false && (
                            <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/[0.08] border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <i className="fas fa-triangle-exclamation text-amber-500 shrink-0 text-sm" />
                                    <span className="text-xs font-bold">
                                        More usage data needed for future forecasts: System records span {summary.history_span_days || 0} / 1,095 days. Showing current stock counts and incoming orders.
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0">
                                    Needs 3+ Yrs
                                </span>
                            </div>
                        )}

                        <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.15)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]">
                            <table className="table-pro w-full min-w-[1250px] text-left text-xs">
                                <thead className="bg-[#ebf0f7] dark:bg-[#12131b] text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200/80 dark:border-white/[0.06]">
                                    <tr>
                                        <th className="px-5 py-4 font-bold min-w-[140px] whitespace-nowrap">Item Code</th>
                                        <th className="px-5 py-4 font-bold min-w-[240px]">Item Name</th>
                                        <th className="px-5 py-4 font-bold min-w-[140px] whitespace-nowrap">Category</th>
                                        <th className="px-5 py-4 text-right font-bold min-w-[120px] whitespace-nowrap">In Stock</th>
                                        <th className="px-5 py-4 text-right font-bold min-w-[150px] whitespace-nowrap">Expected Demand</th>
                                        <th className="px-5 py-4 text-right font-bold min-w-[140px] whitespace-nowrap">Incoming Orders</th>
                                        <th className="px-5 py-4 text-right font-bold min-w-[140px] whitespace-nowrap">Projected Stock</th>
                                        <th className="px-5 py-4 text-right font-bold min-w-[120px] whitespace-nowrap">Min Stock</th>
                                        <th className="px-5 py-4 text-center font-bold min-w-[130px] whitespace-nowrap">Status</th>
                                        <th className="px-5 py-4 font-bold min-w-[260px]">Suggested Action</th>
                                        <th className="px-5 py-4 text-center font-bold min-w-[190px] whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                                    {displayItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="p-12 text-center text-slate-400 block w-full md:table-cell">
                                                No inventory items match the current filter criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayItems.map((item) => {
                                             const riskTone: BadgeTone =
                                                item.risk_level === "Critical"
                                                    ? "rose"
                                                    : item.risk_level === "Low Stock Risk"
                                                    ? "amber"
                                                    : "emerald";

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-white/60 dark:hover:bg-[#1c1d28]/60 transition-colors"
                                                >
                                                    <td className="px-5 py-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap" data-label="Item Code">
                                                        {item.item_code}
                                                    </td>
                                                    <td className="px-5 py-4 font-medium text-slate-800 dark:text-slate-200" data-label="Item Name">
                                                        {item.item_name}
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-500 font-medium whitespace-nowrap" data-label="Category">
                                                        {item.category}
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-semibold whitespace-nowrap" data-label="Available">
                                                        {item.available_stock} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap" data-label="Expected Demand">
                                                        {item.is_prediction_valid === false || summary?.has_three_years_history === false ? (
                                                            <div>
                                                                <span className="text-slate-500 dark:text-slate-400">0</span> <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                                                                <span className="block text-[9px] font-bold text-amber-600 dark:text-amber-400">Needs 3+ Yrs</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {item.forecast_demand} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap" data-label="Expected Incoming">
                                                        +{item.expected_incoming}
                                                    </td>
                                                    <td
                                                        className={`px-5 py-4 text-right font-black whitespace-nowrap ${
                                                            item.risk_level === "Critical"
                                                                ? "text-rose-600 dark:text-rose-400"
                                                                : item.risk_level === "Low Stock Risk"
                                                                ? "text-amber-600 dark:text-amber-400"
                                                                : "text-emerald-600 dark:text-emerald-400"
                                                        }`}
                                                        data-label="Projected Stock"
                                                    >
                                                        {item.projected_stock} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                                                    </td>
                                                    <td className="px-5 py-4 text-right text-slate-500 font-medium whitespace-nowrap" data-label="Min Stock">
                                                        {item.minimum_stock}
                                                    </td>
                                                    <td className="px-5 py-4 text-center whitespace-nowrap" data-label="Risk Level">
                                                        <StatusBadge tone={riskTone} dot>
                                                            {item.risk_level}
                                                        </StatusBadge>
                                                    </td>
                                                    <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed" data-label="Recommended Action">
                                                        {item.recommended_action}
                                                    </td>
                                                    <td className="px-5 py-4 text-center whitespace-nowrap" data-label="Actions">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setDetailModalItem(item)}
                                                                className="px-3 py-1.5 rounded-xl bg-pink-500 text-white text-xs font-bold shadow-[2px_2px_5px_rgba(236,72,153,0.35)] hover:bg-pink-600 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                                                title="View Forecast Details"
                                                            >
                                                                <i className="fas fa-chart-line text-xs" />
                                                                <span>Forecast</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setHistoryModalItem(item)}
                                                                className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#1b1c28] text-slate-700 dark:text-slate-200 border border-white/80 dark:border-white/[0.06] text-xs font-bold shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.4)] hover:bg-slate-200 dark:hover:bg-[#232533] active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                                                title="View Stock History"
                                                            >
                                                                <i className="fas fa-clock-rotate-left text-xs" />
                                                                <span>History</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 3: Usage History */}
                {activeTab === "consumption" && (
                    <div className="space-y-6">
                        {/* Periodic Issuance Trend */}
                        <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-lg bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 text-[11px]">
                                            <i className="fas fa-chart-column" />
                                        </span>
                                        Warehouse Stock Usage Over Time
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Total items issued out of warehouse storage
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-full border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                    <button
                                        type="button"
                                        onClick={() => setConsumptionView("daily")}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                            consumptionView === "daily"
                                                ? "bg-pink-500 text-white shadow-[0_2px_6px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.5)]"
                                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                        }`}
                                    >
                                        Daily
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConsumptionView("weekly")}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                            consumptionView === "weekly"
                                                ? "bg-pink-500 text-white shadow-[0_2px_6px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.5)]"
                                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                        }`}
                                    >
                                        Weekly
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConsumptionView("monthly")}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                            consumptionView === "monthly"
                                                ? "bg-pink-500 text-white shadow-[0_2px_6px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.5)]"
                                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                        }`}
                                    >
                                        Monthly
                                    </button>
                                </div>
                            </div>

                            {/* Debossed Inset Chart Canvas Well */}
                            <div
                                onClick={() => setChartModalDomain("consumption")}
                                className="p-4 sm:p-5 rounded-2xl bg-[#ebf0f7]/70 dark:bg-[#12131b]/80 border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] cursor-pointer group relative"
                            >
                                {/* Hover Inspector Hint */}
                                <div className="absolute top-3 right-3 z-10 opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white/80 dark:bg-black/60 backdrop-blur-xs border border-indigo-500/30 shadow-xs flex items-center gap-1.5">
                                        <i className="fas fa-expand text-[9px]" />
                                        <span>Inspect Consumption &amp; Realtime Data</span>
                                    </span>
                                </div>
                                {loading ? (
                                    <div className="h-64 sm:h-72 w-full flex flex-col items-center justify-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-indigo-500 animate-spin">
                                            <i className="fas fa-circle-notch text-base" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                            Aggregating historical warehouse consumption issuances...
                                        </span>
                                    </div>
                                ) : (
                                    <div className="h-64 sm:h-72 w-full relative">
                                        <canvas ref={consumptionChartRef} className="w-full h-full block" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top Consumed & Department Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top Consumed Items */}
                            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] flex items-center justify-center text-amber-500 text-[11px]">
                                        <i className="fas fa-ranking-star" />
                                    </span>
                                    Most Frequently Consumed Supplies
                                </h4>
                                <div className="space-y-2.5">
                                    {forecastData?.consumption_analysis?.top_consumed_items?.length ? (
                                        forecastData.consumption_analysis.top_consumed_items.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-between text-xs"
                                            >
                                                <div>
                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                        {item.item_name}
                                                    </span>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        {item.item_code} • {item.events} issuance events
                                                    </div>
                                                </div>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                                    {item.total_quantity} {item.unit}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-400 py-6 text-center">No issuance records logged in this period.</p>
                                    )}
                                </div>
                            </div>

                            {/* Department Breakdown */}
                            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] flex items-center justify-center text-blue-500 text-[11px]">
                                        <i className="fas fa-building" />
                                    </span>
                                    Consumption by Receiving Department
                                </h4>
                                <div className="space-y-2.5">
                                    {forecastData?.consumption_analysis?.department_breakdown?.length ? (
                                        forecastData.consumption_analysis.department_breakdown.map((dept, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-between text-xs"
                                            >
                                                <div>
                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                        {dept.department}
                                                    </span>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        {dept.count} fulfillment requisitions
                                                    </div>
                                                </div>
                                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                                    {dept.total_quantity} units
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-400 py-6 text-center">No department issuance recorded.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: Item Movement Velocity (Fast-Moving & Slowest-Moving Items) */}
                {activeTab === "movement" && (
                    <ItemMovementSection
                        movementData={forecastData?.item_movement_analytics}
                        periodDays={periodDays}
                        onPeriodChange={(days) => {
                            setCustomDateRange(null);
                            setPeriodDays(days);
                        }}
                        onCustomRangeApply={(from, to) => {
                            setCustomDateRange({ from, to });
                        }}
                        currentStartDate={customDateRange?.from || forecastData?.item_movement_analytics?.start_date}
                        currentEndDate={customDateRange?.to || forecastData?.item_movement_analytics?.end_date}
                        isLoading={loading || isRefreshing}
                        onOpenChartModal={(domain) => setChartModalDomain(domain as ForecastChartDomain)}
                    />
                )}

                {/* Modals */}
                <ForecastExportModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    forecastData={forecastData}
                    chartCanvases={{
                        demandChart: demandChartRef.current,
                        consumptionChart: consumptionChartRef.current
                    }}
                />

                <ItemForecastModal
                    isOpen={!!detailModalItem}
                    onClose={() => setDetailModalItem(null)}
                    item={detailModalItem}
                    horizonDays={horizonDays}
                    historicalPeriodDays={periodDays}
                />

                <ItemHistoryModal
                    isOpen={!!historyModalItem}
                    onClose={() => setHistoryModalItem(null)}
                    item={historyModalItem}
                    historicalPeriodDays={periodDays}
                />

                <ForecastChartDetailsModal
                    isOpen={Boolean(chartModalDomain)}
                    onClose={() => setChartModalDomain(null)}
                    initialDomain={chartModalDomain || "dashboard"}
                    forecastData={forecastData}
                    periodDays={periodDays}
                    horizonDays={horizonDays}
                    onRefreshData={() => fetchForecast(true)}
                />
            </div>
        </SessionGuard>
    );
}

export default function ForecastPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#ebf0f7] dark:bg-[#14151c] p-6 max-w-7xl mx-auto space-y-4">
                    <CardsSkeleton count={4} />
                </div>
            }
        >
            <ForecastContent />
        </Suspense>
    );
}
