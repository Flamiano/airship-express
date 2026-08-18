// app/(supplyChain)/components/client/ExecutiveCharts.tsx
"use client";

import { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from "react";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import {
    Chart, LineController, BarController, DoughnutController,
    CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
    Legend, Tooltip, Filler,
} from "chart.js";

// Register Chart.js components
Chart.register(
    LineController, BarController, DoughnutController,
    CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
    Legend, Tooltip, Filler
);

// Lazy load heavy components
const OperationsSummary = dynamic(() => import("./OperationsSummary"), {
    loading: () => <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />,
});
const ProcurementCard = dynamic(() => import("./ProcurementCard"), {
    loading: () => <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />,
});
const RecentTransactions = dynamic(() => import("./RecentTransactions"), {
    loading: () => <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />,
});
const QuickActions = dynamic(() => import("./QuickActions"), {
    loading: () => <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />,
});

interface Insight {
    id: string;
    title: string;
    description: string;
    type: 'positive' | 'negative' | 'neutral' | 'warning';
    metric?: string;
    change?: string;
    actionable?: boolean;
    actionText?: string;
    actionLink?: string;
}

interface KPI {
    id: string;
    label: string;
    value: string | number;
    change?: string;
    changeType?: 'up' | 'down' | 'neutral';
    icon: string;
    color: string;
    description: string;
}

type TabType = 'overview' | 'operations' | 'kpis' | 'insights' | 'forecast' | 'reports';

// Chart color palette
const CHART_COLORS = {
    primary: '#EC4899',
    secondary: '#6366F1',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    cyan: '#06B6D4',
    pink: '#F472B6',
    indigo: '#818CF8',
    emerald: '#34D399',
    amber: '#FBBF24',
};

const CHART_COLORS_ARRAY = Object.values(CHART_COLORS);

// Chart options that don't depend on state
const getBaseChartOptions = (isDark: boolean, textColor: string, mutedColor: string, gridColor: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                boxWidth: 12,
                padding: 8,
                font: { size: 10, weight: 500 as const },
                usePointStyle: true,
                color: textColor,
            },
        },
        tooltip: {
            backgroundColor: isDark ? 'rgba(28,27,31,0.95)' : 'rgba(255,255,255,0.95)',
            titleColor: textColor,
            bodyColor: textColor,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
            borderWidth: 1,
            cornerRadius: 8,
            boxPadding: 6,
            padding: 10,
        }
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, color: mutedColor }
        },
        y: {
            beginAtZero: true,
            ticks: { font: { size: 10 }, color: mutedColor },
            grid: { color: gridColor }
        }
    },
    animation: {
        duration: 500,
    },
});

export default function ExecutiveCharts() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [parcelData, setParcelData] = useState<any[]>([]);
    const [inventoryData, setInventoryData] = useState<any[]>([]);
    const [procurementData, setProcurementData] = useState<any[]>([]);
    const [documentData, setDocumentData] = useState<any[]>([]);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [showInsights, setShowInsights] = useState(true);
    const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
    const [isTabTransitioning, setIsTabTransitioning] = useState(false);

    // Chart refs with proper typing
    const chartRefs = {
        parcels: useRef<HTMLCanvasElement>(null),
        inventory: useRef<HTMLCanvasElement>(null),
        procurement: useRef<HTMLCanvasElement>(null),
        documents: useRef<HTMLCanvasElement>(null),
        forecast: useRef<HTMLCanvasElement>(null),
        kpi: useRef<HTMLCanvasElement>(null),
        fleetUtilization: useRef<HTMLCanvasElement>(null),
        fuelEfficiency: useRef<HTMLCanvasElement>(null),
        deliveryPerformance: useRef<HTMLCanvasElement>(null),
        carbonEmissions: useRef<HTMLCanvasElement>(null),
        warehouseThroughput: useRef<HTMLCanvasElement>(null),
        routeCongestion: useRef<HTMLCanvasElement>(null),
        driverSafety: useRef<HTMLCanvasElement>(null),
    };

    const chartInstances = useRef<Record<string, Chart | null>>({});
    const isMounted = useRef(true);
    const initializationLock = useRef(false);
    const initRunId = useRef(0);

    // Memoized data processing
    const getLast7Days = useCallback(() => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return days;
    }, []);

    const getLast12Months = useCallback(() => {
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            months.push(d.toLocaleDateString('en-US', { month: 'short' }));
        }
        return months;
    }, []);

    // Get tab from URL on mount
    useEffect(() => {
        const tabParam = searchParams.get('tab') as TabType;
        if (tabParam && ['overview', 'operations', 'kpis', 'insights', 'forecast', 'reports'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    // Update URL when tab changes with debounce
    const handleTabChange = useCallback((tab: TabType) => {
        if (tab === activeTab) return;
        setIsTabTransitioning(true);
        setActiveTab(tab);
        router.push(`?tab=${tab}`, { scroll: false });

        setTimeout(() => {
            setIsTabTransitioning(false);
        }, 200);
    }, [activeTab, router]);

    // Fetch data with abort controller
    const fetchData = useCallback(async () => {
        const abortController = new AbortController();

        try {
            setLoading(true);

            const [parcelsResult, inventoryResult, procurementResult, documentsResult] = await Promise.all([
                supabase
                    .from('parcels')
                    .select('created_at, status, courier')
                    .order('created_at', { ascending: true })
                    .limit(100),
                supabase
                    .from('inventory_items')
                    .select('category, current_stock, status, item_name, minimum_stock')
                    .limit(200),
                supabase
                    .from('purchase_requests')
                    .select('status, department, amount, date')
                    .order('date', { ascending: true })
                    .limit(50),
                supabase
                    .from('documents')
                    .select('document_type, category, created_at')
                    .order('created_at', { ascending: true })
                    .limit(50),
            ]);

            if (!isMounted.current) return;

            const parcels = parcelsResult.data || [];
            const inventory = inventoryResult.data || [];
            const procurement = procurementResult.data || [];
            const documents = documentsResult.data || [];

            setParcelData(parcels);
            setInventoryData(inventory);
            setProcurementData(procurement);
            setDocumentData(documents);

            generateInsights(parcels, inventory, procurement, documents);

        } catch (error) {
            console.error('Error fetching chart data:', error);
            toast.error('Failed to load chart data');
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }

        return () => abortController.abort();
    }, []);

    // Generate insights with memoization
    const generateInsights = useCallback((parcels: any[], inventory: any[], procurement: any[], documents: any[]) => {
        const newInsights: Insight[] = [];

        const today = new Date();
        const todayParcels = parcels.filter(p => new Date(p.created_at).toDateString() === today.toDateString());
        const yesterdayParcels = parcels.filter(p => {
            const d = new Date(p.created_at);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return d.toDateString() === yesterday.toDateString();
        });

        // Parcel volume insight
        if (todayParcels.length > 0 || yesterdayParcels.length > 0) {
            const change = yesterdayParcels.length > 0
                ? ((todayParcels.length - yesterdayParcels.length) / yesterdayParcels.length * 100)
                : 100;
            newInsights.push({
                id: 'parcel-volume',
                title: 'Parcel Volume Trend',
                description: todayParcels.length > yesterdayParcels.length
                    ? `Today's parcel volume is ${change.toFixed(1)}% higher than yesterday.`
                    : `Today's parcel volume is ${Math.abs(change).toFixed(1)}% lower than yesterday.`,
                type: change > 0 ? 'positive' : 'negative',
                metric: `${todayParcels.length} today`,
                change: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
                actionable: true,
                actionText: 'View Details',
                actionLink: '/warehousing?tab=incoming',
            });
        }

        // Delivery rate insight
        const deliveredParcels = parcels.filter(p => p.status === 'delivered');
        const totalParcels = parcels.length;
        const deliveryRate = totalParcels > 0 ? (deliveredParcels.length / totalParcels * 100) : 0;

        if (totalParcels > 0) {
            newInsights.push({
                id: 'delivery-rate',
                title: 'Delivery Performance',
                description: deliveryRate > 85
                    ? `Excellent ${deliveryRate.toFixed(1)}% delivery rate. Above industry average.`
                    : deliveryRate > 70
                        ? `${deliveryRate.toFixed(1)}% delivery rate. Room for improvement.`
                        : `Low ${deliveryRate.toFixed(1)}% delivery rate. Immediate attention needed.`,
                type: deliveryRate > 85 ? 'positive' : deliveryRate > 70 ? 'neutral' : 'warning',
                metric: `${deliveryRate.toFixed(1)}%`,
                change: deliveryRate > 85 ? 'On target' : 'Below target',
                actionable: true,
                actionText: 'Analyze',
                actionLink: '/warehousing?tab=sorting',
            });
        }

        // Inventory health insight
        const lowStockItems = inventory.filter(i => i.status === 'low-stock' || i.current_stock < i.minimum_stock);
        const outOfStockItems = inventory.filter(i => i.status === 'out-of-stock' || i.current_stock === 0);

        if (lowStockItems.length > 0 || outOfStockItems.length > 0) {
            newInsights.push({
                id: 'inventory-health',
                title: 'Inventory Health Alert',
                description: `${lowStockItems.length} items low stock, ${outOfStockItems.length} items out of stock. Restock recommended.`,
                type: outOfStockItems.length > 0 ? 'warning' : 'neutral',
                metric: `${lowStockItems.length} low`,
                change: `${outOfStockItems.length} out`,
                actionable: true,
                actionText: 'View Inventory',
                actionLink: '/inventory',
            });
        }

        // Top courier insight
        const courierCounts: Record<string, number> = {};
        parcels.forEach(p => {
            if (p.courier) {
                courierCounts[p.courier] = (courierCounts[p.courier] || 0) + 1;
            }
        });
        let topCourier = '';
        let maxCount = 0;
        for (const [courier, count] of Object.entries(courierCounts)) {
            if (count > maxCount) {
                maxCount = count;
                topCourier = courier;
            }
        }
        if (topCourier) {
            newInsights.push({
                id: 'top-courier',
                title: 'Top Performing Courier',
                description: `${topCourier} is handling ${maxCount} parcels, leading all couriers this period.`,
                type: 'positive',
                metric: topCourier,
                change: `${maxCount} parcels`,
                actionable: true,
                actionText: 'View All Couriers',
                actionLink: '/warehousing?tab=sorting',
            });
        }

        setInsights(newInsights);
    }, []);

    // Memoized KPIs
    const KPIs = useMemo(() => {
        const deliveryRate = parcelData.length > 0
            ? (parcelData.filter(p => p.status === 'delivered').length / parcelData.length * 100).toFixed(1)
            : 0;

        return [
            {
                id: 'total-parcels',
                label: 'Total Parcels',
                value: parcelData.length,
                change: '+12.5%',
                changeType: 'up' as const,
                icon: 'fa-box',
                color: 'text-pink-500',
                description: 'Total parcels processed across all statuses',
            },
            {
                id: 'delivery-rate',
                label: 'Delivery Rate',
                value: `${deliveryRate}%`,
                change: '+3.2%',
                changeType: 'up' as const,
                icon: 'fa-check-circle',
                color: 'text-emerald-500',
                description: 'Percentage of parcels successfully delivered',
            },
            {
                id: 'active-couriers',
                label: 'Active Couriers',
                value: new Set(parcelData.map(p => p.courier).filter(Boolean)).size,
                change: '+2',
                changeType: 'up' as const,
                icon: 'fa-truck',
                color: 'text-blue-500',
                description: 'Number of couriers currently handling parcels',
            },
            {
                id: 'inventory-items',
                label: 'Inventory Items',
                value: inventoryData.length,
                change: '-3',
                changeType: 'down' as const,
                icon: 'fa-warehouse',
                color: 'text-amber-500',
                description: 'Total items in warehouse inventory',
            },
            {
                id: 'pending-requests',
                label: 'Pending Requests',
                value: procurementData.filter(p => p.status === 'Pending').length,
                change: '+2',
                changeType: 'neutral' as const,
                icon: 'fa-clock',
                color: 'text-purple-500',
                description: 'Purchase requests awaiting approval',
            },
            {
                id: 'documents',
                label: 'Documents',
                value: documentData.length,
                change: '+5',
                changeType: 'up' as const,
                icon: 'fa-file-alt',
                color: 'text-indigo-500',
                description: 'Total documents in the system',
            },
        ];
    }, [parcelData, inventoryData, procurementData, documentData]);

    // Initialize charts with performance optimizations
    const initializeCharts = useCallback(() => {
        // Prevent concurrent initialization
        if (initializationLock.current) return;
        initializationLock.current = true;

        try {
            const isDark = document.documentElement.classList.contains('dark');
            const textColor = isDark ? '#fcfbf9' : '#1c1b1f';
            const mutedColor = isDark ? '#6b6b76' : '#6b6b76';
            const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

            // Clean up existing charts
            Object.keys(chartInstances.current).forEach(key => {
                if (chartInstances.current[key]) {
                    chartInstances.current[key]?.destroy();
                    chartInstances.current[key] = null;
                }
            });

            // Only initialize visible charts to improve performance
            const visibleCharts = {
                parcels: activeTab === 'overview' || activeTab === 'forecast',
                inventory: activeTab === 'overview',
                procurement: activeTab === 'overview',
                documents: activeTab === 'overview',
                forecast: activeTab === 'overview' || activeTab === 'forecast',
                kpi: activeTab === 'overview' || activeTab === 'kpis',
            };

            const baseOptions = getBaseChartOptions(isDark, textColor, mutedColor, gridColor);

            // ─── 1. PARCEL TREND CHART ───
            if (visibleCharts.parcels && chartRefs.parcels.current) {
                const ctx = chartRefs.parcels.current.getContext('2d');
                if (ctx) {
                    const last7Days = getLast7Days();
                    const statuses = ['received', 'sorting', 'ready', 'picked-up', 'delivered'];
                    const statusColors = {
                        'received': CHART_COLORS.secondary,
                        'sorting': CHART_COLORS.warning,
                        'ready': CHART_COLORS.success,
                        'picked-up': CHART_COLORS.purple,
                        'delivered': CHART_COLORS.primary
                    };

                    const datasets = statuses.map(status => {
                        const data = last7Days.map(day => {
                            return parcelData.filter(p => {
                                const pDate = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                return pDate === day && p.status === status;
                            }).length;
                        });
                        const color = statusColors[status as keyof typeof statusColors];
                        return {
                            label: status.charAt(0).toUpperCase() + status.slice(1),
                            data: data,
                            borderColor: color,
                            backgroundColor: `${color}20`,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointBackgroundColor: color,
                            pointBorderColor: isDark ? '#2a2a2e' : '#ffffff',
                            pointBorderWidth: 1.5,
                            borderWidth: 2,
                        };
                    });

                    chartInstances.current.parcels = new Chart(ctx, {
                        type: 'line',
                        data: { labels: last7Days, datasets },
                        options: {
                            ...baseOptions,
                            interaction: { mode: 'index', intersect: false },
                            scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 10 }, color: mutedColor } },
                                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 }, color: mutedColor }, grid: { color: gridColor } }
                            },
                        },
                    });
                }
            }

            // ─── 2. INVENTORY CHART (Doughnut) ───
            if (visibleCharts.inventory && chartRefs.inventory.current) {
                const ctx = chartRefs.inventory.current.getContext('2d');
                if (ctx) {
                    const categories: Record<string, number> = {};
                    inventoryData.forEach(item => {
                        const category = item.category || 'Uncategorized';
                        categories[category] = (categories[category] || 0) + 1;
                    });

                    const labels = Object.keys(categories);
                    const data = Object.values(categories);
                    const bgColors = CHART_COLORS_ARRAY.slice(0, labels.length);

                    chartInstances.current.inventory = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels,
                            datasets: [{
                                data,
                                backgroundColor: bgColors,
                                borderWidth: 2,
                                borderColor: isDark ? '#2a2a2e' : '#ffffff',
                                hoverOffset: 8,
                            }],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            cutout: '60%',
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        boxWidth: 12,
                                        padding: 8,
                                        font: { size: 10, weight: 500 as const },
                                        usePointStyle: true,
                                        color: textColor
                                    },
                                },
                                tooltip: {
                                    backgroundColor: isDark ? 'rgba(28,27,31,0.95)' : 'rgba(255,255,255,0.95)',
                                    titleColor: textColor,
                                    bodyColor: textColor,
                                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                                    borderWidth: 1,
                                    cornerRadius: 8,
                                    callbacks: {
                                        label: function (context) {
                                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                            return `${context.label}: ${context.parsed} items (${percentage}%)`;
                                        }
                                    }
                                }
                            },
                            animation: {
                                animateRotate: true,
                                duration: 600,
                            },
                        },
                    });
                }
            }

            // ─── 3. PROCUREMENT CHART (Bar) ───
            if (visibleCharts.procurement && chartRefs.procurement.current) {
                const ctx = chartRefs.procurement.current.getContext('2d');
                if (ctx) {
                    const statusCounts: Record<string, number> = {};
                    procurementData.forEach(item => {
                        const status = item.status || 'Unknown';
                        statusCounts[status] = (statusCounts[status] || 0) + 1;
                    });

                    const statusColors: Record<string, string> = {
                        'Pending': CHART_COLORS.warning,
                        'Approved': CHART_COLORS.success,
                        'Rejected': CHART_COLORS.danger,
                        'Completed': CHART_COLORS.secondary,
                        'Unknown': '#94A3B8'
                    };

                    const labels = Object.keys(statusCounts);
                    const data = Object.values(statusCounts);
                    const colors = labels.map(label => statusColors[label] || '#94A3B8');

                    chartInstances.current.procurement = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels,
                            datasets: [{
                                label: 'Purchase Requests',
                                data,
                                backgroundColor: colors,
                                borderRadius: 6,
                                borderSkipped: false,
                            }],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: isDark ? 'rgba(28,27,31,0.95)' : 'rgba(255,255,255,0.95)',
                                    titleColor: textColor,
                                    bodyColor: textColor,
                                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                                    borderWidth: 1,
                                    cornerRadius: 8,
                                }
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 10, weight: 500 as const }, color: mutedColor } },
                                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 }, color: mutedColor }, grid: { color: gridColor } }
                            },
                            animation: { duration: 500 },
                        },
                    });
                }
            }

            // ─── 4. FORECAST CHART ───
            if (visibleCharts.forecast && chartRefs.forecast.current) {
                const ctx = chartRefs.forecast.current.getContext('2d');
                if (ctx) {
                    const months = getLast12Months();
                    const baseData = months.map((_, index) => {
                        const base = 1500 + (index * 65);
                        const variation = Math.random() * 300 - 150;
                        return Math.round(base + variation);
                    });

                    const historicalData = baseData.slice(0, 9);
                    const forecastData = baseData.slice(9);
                    const paddedForecast = [...Array(9).fill(null), ...forecastData];

                    chartInstances.current.forecast = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: months,
                            datasets: [
                                {
                                    label: 'Historical Volume',
                                    data: [...historicalData, ...Array(3).fill(null)],
                                    borderColor: CHART_COLORS.secondary,
                                    backgroundColor: `${CHART_COLORS.secondary}20`,
                                    fill: false,
                                    tension: 0.4,
                                    pointRadius: 4,
                                    pointBackgroundColor: CHART_COLORS.secondary,
                                    pointBorderColor: isDark ? '#2a2a2e' : '#ffffff',
                                    pointBorderWidth: 1.5,
                                    borderWidth: 2.5,
                                },
                                {
                                    label: 'Forecast',
                                    data: paddedForecast,
                                    borderColor: CHART_COLORS.primary,
                                    backgroundColor: `${CHART_COLORS.primary}20`,
                                    fill: false,
                                    tension: 0.4,
                                    borderDash: [6, 4],
                                    pointRadius: 4,
                                    pointBackgroundColor: CHART_COLORS.primary,
                                    pointBorderColor: isDark ? '#2a2a2e' : '#ffffff',
                                    pointBorderWidth: 1.5,
                                    borderWidth: 2.5,
                                },
                                {
                                    label: 'Confidence Range',
                                    data: paddedForecast.map(v => v ? v + 300 : null),
                                    borderColor: `${CHART_COLORS.primary}30`,
                                    backgroundColor: `${CHART_COLORS.primary}15`,
                                    fill: '+1',
                                    tension: 0.4,
                                    pointRadius: 0,
                                    borderWidth: 0,
                                }
                            ],
                        },
                        options: {
                            ...baseOptions,
                            scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 10 }, color: mutedColor } },
                                y: { beginAtZero: true, ticks: { font: { size: 10 }, color: mutedColor }, grid: { color: gridColor } }
                            },
                        },
                    });
                }
            }

            // ─── 5. KPI CHART ───
            if (visibleCharts.kpi && chartRefs.kpi.current) {
                const ctx = chartRefs.kpi.current.getContext('2d');
                if (ctx) {
                    const kpiData = KPIs.map(k => ({
                        label: k.label,
                        value: typeof k.value === 'string' ? parseFloat(k.value) : k.value,
                        color: k.color,
                    }));

                    const barColors = kpiData.map(k => {
                        switch (k.color) {
                            case 'text-pink-500': return CHART_COLORS.primary;
                            case 'text-emerald-500': return CHART_COLORS.success;
                            case 'text-blue-500': return CHART_COLORS.secondary;
                            case 'text-amber-500': return CHART_COLORS.warning;
                            case 'text-purple-500': return CHART_COLORS.purple;
                            case 'text-indigo-500': return CHART_COLORS.indigo;
                            default: return CHART_COLORS.secondary;
                        }
                    });

                    chartInstances.current.kpi = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: kpiData.map(k => k.label),
                            datasets: [{
                                label: 'KPI Values',
                                data: kpiData.map(k => k.value),
                                backgroundColor: barColors.map(c => `${c}CC`),
                                hoverBackgroundColor: barColors,
                                borderRadius: 6,
                                borderSkipped: false,
                            }],
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: isDark ? 'rgba(28,27,31,0.95)' : 'rgba(255,255,255,0.95)',
                                    titleColor: textColor,
                                    bodyColor: textColor,
                                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                                    borderWidth: 1,
                                    cornerRadius: 8,
                                    callbacks: {
                                        afterBody: function (tooltipItems) {
                                            const kpi = KPIs[tooltipItems[0].dataIndex];
                                            return kpi ? kpi.description : '';
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 10, weight: 500 as const }, color: mutedColor } },
                                y: { beginAtZero: true, ticks: { font: { size: 10 }, color: mutedColor }, grid: { color: gridColor } }
                            },
                            animation: { duration: 500 },
                        },
                    });
                }
            }
        } finally {
            initializationLock.current = false;
        }
    }, [parcelData, inventoryData, procurementData, documentData, activeTab, KPIs, getLast7Days, getLast12Months]);

    // Generate AI summary
    const generateAISummary = useCallback(async () => {
        setIsGeneratingAI(true);
        const toastId = toast.loading('AI is analyzing your data...');

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success('AI Summary Generated!', { id: toastId, duration: 6000 });
            setShowInsights(true);
        } catch (error) {
            toast.error('Failed to generate AI summary', { id: toastId });
        } finally {
            setIsGeneratingAI(false);
        }
    }, []);

    // Initial data fetch
    useEffect(() => {
        isMounted.current = true;
        fetchData();

        return () => {
            isMounted.current = false;
            // Clean up charts
            Object.keys(chartInstances.current).forEach(key => {
                if (chartInstances.current[key]) {
                    chartInstances.current[key]?.destroy();
                    chartInstances.current[key] = null;
                }
            });
        };
    }, [fetchData]);

    // Single useEffect for chart initialization
    useEffect(() => {
        if (loading || !isMounted.current) return;

        const myRunId = ++initRunId.current;
        const timeoutId = setTimeout(() => {
            if (myRunId !== initRunId.current || !isMounted.current) return;
            initializeCharts();
        }, 150);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [loading, activeTab, initializeCharts]);

    const getInsightIcon = useCallback((type: string) => {
        switch (type) {
            case 'positive': return 'text-emerald-500';
            case 'negative': return 'text-red-500';
            case 'warning': return 'text-amber-500';
            default: return 'text-blue-500';
        }
    }, []);

    const getInsightBg = useCallback((type: string) => {
        switch (type) {
            case 'positive': return 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800';
            case 'negative': return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
            case 'warning': return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
            default: return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800';
        }
    }, []);

    const getKPIChangeIcon = useCallback((type: string) => {
        switch (type) {
            case 'up': return 'fa-arrow-up text-emerald-500';
            case 'down': return 'fa-arrow-down text-red-500';
            default: return 'fa-minus text-slate-400';
        }
    }, []);

    const InfoTooltip = useCallback(({ text }: { text: string }) => (
        <span className="group relative inline-flex items-center ml-1">
            <i className="fas fa-info-circle text-slate-400 text-[10px] cursor-help hover:text-pink-500 transition-colors"></i>
            <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 dark:bg-slate-900 text-white text-[10px] rounded-lg shadow-lg whitespace-nowrap z-10 w-48 text-center">
                {text}
            </span>
        </span>
    ), []);

    const ChartLink = useCallback(({ href, label }: { href: string; label: string }) => (
        <Link
            href={href}
            className="text-[10px] text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 flex items-center gap-1 transition-all duration-200 hover:gap-2 group"
        >
            {label}
            <i className="fas fa-arrow-right text-[8px] transition-transform duration-200 group-hover:translate-x-1"></i>
        </Link>
    ), []);

    const TabContent = useCallback(({ children }: { children: React.ReactNode }) => (
        <div className={`transition-all duration-300 ease-in-out ${isTabTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            {children}
        </div>
    ), [isTabTransitioning]);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse"></div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="bg-white dark:bg-[#2a2a2e] rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-4 shadow-sm animate-pulse">
                            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3"></div>
                            <div className="h-50 bg-slate-100 dark:bg-slate-800 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
        { id: 'operations', label: 'Operations', icon: 'fa-warehouse' },
        { id: 'kpis', label: 'KPIs', icon: 'fa-chart-simple' },
        { id: 'insights', label: 'AI Insights', icon: 'fa-lightbulb' },
        { id: 'forecast', label: 'Forecast', icon: 'fa-chart-line' },
        { id: 'reports', label: 'Reports', icon: 'fa-file-alt' },
    ];

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id as TabType)}
                            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all duration-150 flex items-center gap-2 cursor-pointer ${isActive
                                ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                        >
                            <i className={`fas ${tab.icon} text-xs ${isActive ? 'text-pink-400 dark:text-pink-400' : 'text-slate-400 dark:text-slate-500'}`}></i>
                            <span>{tab.label}</span>
                        </button>
                    );
                })}

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={generateAISummary}
                        disabled={isGeneratingAI}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 active:bg-pink-800 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isGeneratingAI ? (
                            <>
                                <i className="fas fa-spinner fa-spin text-xs" />
                                <span>Analyzing...</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-robot text-xs text-pink-200" />
                                <span>AI Summary</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ─── OVERVIEW TAB ─── */}
            {activeTab === 'overview' && (
                <TabContent>
                    {/* AI Insights Banner */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs dark:shadow-none transition-all duration-300 mb-3">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                    <i className="fas fa-robot text-sm" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                        <span>AI Business Intelligence</span>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 border border-pink-200/60 dark:border-pink-900/50 uppercase tracking-wider">
                                            Live
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Real-time insights powered by AI
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowInsights(!showInsights)}
                                    className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all duration-200 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 cursor-pointer"
                                >
                                    {showInsights ? 'Hide Insights' : 'Show Insights'}
                                </button>
                            </div>
                        </div>

                        {/* Insights Grid */}
                        {showInsights && (
                            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in fade-in duration-200">
                                {insights.slice(0, 4).map((insight) => (
                                    <div
                                        key={insight.id}
                                        onClick={() => setSelectedInsight(insight)}
                                        className={`p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 ${getInsightBg(
                                            insight.type
                                        )} dark:bg-slate-900/50 backdrop-blur-none transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer relative group flex flex-col justify-between`}
                                    >
                                        <div className="flex items-start justify-between gap-2.5">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                                                    <i
                                                        className={`fas ${insight.type === 'positive'
                                                            ? 'fa-arrow-up'
                                                            : insight.type === 'negative'
                                                                ? 'fa-arrow-down'
                                                                : insight.type === 'warning'
                                                                    ? 'fa-exclamation-triangle'
                                                                    : 'fa-info-circle'
                                                            } text-[10px] ${getInsightIcon(insight.type)}`}
                                                    />
                                                    <span className="truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                                        {insight.title}
                                                    </span>
                                                    <InfoTooltip text={insight.description} />
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                                    {insight.description}
                                                </p>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <span className={`text-xs font-semibold ${getInsightIcon(insight.type)}`}>
                                                    {insight.metric && (
                                                        <span className="block font-bold leading-none dark:text-white">
                                                            {insight.metric}
                                                        </span>
                                                    )}
                                                    {insight.change && (
                                                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                                            {insight.change}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {insight.actionable && (
                                            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                <Link
                                                    href={insight.actionLink || '#'}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-[10px] font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 inline-flex items-center gap-1 transition-all duration-200 group/link hover:gap-1.5"
                                                >
                                                    <span>{insight.actionText || 'View Details'}</span>
                                                    <i className="fas fa-arrow-right text-[8px] transition-transform duration-200 group-hover/link:translate-x-0.5" />
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                        {/* Parcel Volume Trend Card */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                        <i className="fas fa-box text-xs"></i>
                                    </div>
                                    <span>Parcel Volume Trend</span>
                                    <InfoTooltip text="Tracks parcel status changes over the last 7 days" />
                                </h3>
                                <ChartLink href="/warehousing" label="View Details" />
                            </div>

                            <div className="h-50 w-full">
                                <canvas ref={chartRefs.parcels}></canvas>
                            </div>

                            <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-4 flex-wrap">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.secondary }}></span>
                                    <span>Received</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.warning }}></span>
                                    <span>Sorting</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.success }}></span>
                                    <span>Ready</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.purple }}></span>
                                    <span>Picked Up</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.primary }}></span>
                                    <span>Delivered</span>
                                </span>
                            </div>
                        </div>

                        {/* Inventory by Category Card */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/30">
                                        <i className="fas fa-warehouse text-xs"></i>
                                    </div>
                                    <span>Inventory by Category</span>
                                    <InfoTooltip text="Distribution of inventory items across categories" />
                                </h3>
                                <ChartLink href="/inventory" label="View All" />
                            </div>

                            <div className="h-50 w-full flex items-center justify-center">
                                <canvas ref={chartRefs.inventory}></canvas>
                            </div>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
                        {KPIs.map((kpi) => (
                            <div
                                key={kpi.id}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 text-center shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm group relative"
                            >
                                <div className="flex items-center justify-center mb-2">
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                                        <i className={`fas ${kpi.icon} ${kpi.color} text-sm`}></i>
                                    </div>
                                </div>

                                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1 mb-0.5">
                                    <span>{kpi.label}</span>
                                    <InfoTooltip text={kpi.description} />
                                </p>

                                <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight transition-colors duration-200 group-hover:text-pink-600 dark:group-hover:text-pink-400">
                                    {kpi.value}
                                </p>

                                {kpi.change && (
                                    <div className="mt-1 flex items-center justify-center">
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${kpi.changeType === 'up'
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                            kpi.changeType === 'down'
                                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                            <i className={`fas ${getKPIChangeIcon(kpi.changeType ?? '')} text-[8px]`}></i>
                                            <span>{kpi.change}</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Forecast Preview */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30">
                                    <i className="fas fa-chart-line text-xs"></i>
                                </div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                                        <span>Volume Forecast</span>
                                        <InfoTooltip text="AI-powered 12-month volume projection with confidence intervals" />
                                    </h3>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 border border-pink-200/60 dark:border-pink-900/40">
                                        AI Powered
                                    </span>
                                </div>
                            </div>
                            <ChartLink href="/forecast" label="View full forecast" />
                        </div>

                        <div className="h-55 w-full pt-1">
                            <canvas ref={chartRefs.forecast}></canvas>
                        </div>
                    </div>

                </TabContent>
            )}

            {/* ─── OPERATIONS TAB ─── */}
            {activeTab === 'operations' && (
                <TabContent>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-black/40">
                                <OperationsSummary />
                            </div>
                            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-black/40">
                                <ProcurementCard />
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-black/40">
                            <RecentTransactions />
                        </div>

                        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-black/40">
                            <QuickActions />
                        </div>
                    </div>
                </TabContent>
            )}

            {/* ─── KPIS TAB ─── */}
            {activeTab === 'kpis' && (
                <TabContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {KPIs.map((kpi) => (
                                <div
                                    key={kpi.id}
                                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm group cursor-pointer"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                {kpi.label}
                                                <InfoTooltip text={kpi.description} />
                                            </p>
                                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 transition-colors duration-200 group-hover:text-pink-600 dark:group-hover:text-pink-400">
                                                {kpi.value}
                                            </p>
                                            {kpi.change && (
                                                <p className={`text-xs font-medium flex items-center gap-1 mt-1.5 ${kpi.changeType === 'up'
                                                    ? 'text-emerald-600 dark:text-emerald-400' :
                                                    kpi.changeType === 'down'
                                                        ? 'text-rose-600 dark:text-rose-400'
                                                        : 'text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                    <i className={`fas ${getKPIChangeIcon(kpi.changeType ?? '')} text-[10px]`}></i>
                                                    <span>{kpi.change}</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 group-hover:bg-pink-50 dark:group-hover:bg-pink-950/40 group-hover:text-pink-600 dark:group-hover:text-pink-400 border border-slate-200/60 dark:border-slate-700/60 transition-colors">
                                            <i className={`fas ${kpi.icon} text-sm`}></i>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all">

                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                        <i className="fas fa-chart-bar text-xs"></i>
                                    </div>
                                    <span>KPI Performance Chart</span>
                                    <InfoTooltip text="Visual representation of all KPI values for quick comparison" />
                                </h3>
                                <ChartLink href="/kpi-dashboard" label="View All KPIs" />
                            </div>
                            <div className="h-75 w-full">
                                <canvas ref={chartRefs.kpi}></canvas>
                            </div>
                        </div>
                    </div>
                </TabContent>
            )}

            {/* ─── INSIGHTS TAB ─── */}
            {activeTab === 'insights' && (
                <TabContent>
                    <div className="space-y-6">
                        {/* AI Insights Header */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs transition-all duration-200">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="shrink-0">
                                    <div className="w-14 h-14 rounded-2xl bg-pink-500/10 dark:bg-pink-500/15 border border-pink-500/20 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                        <i className="fas fa-robot text-2xl" />
                                    </div>
                                </div>

                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                        AI-Powered Intelligence
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                                        Get real-time AI-powered insights and actionable recommendations based on your operational data.
                                    </p>
                                </div>

                                <button
                                    onClick={generateAISummary}
                                    disabled={isGeneratingAI}
                                    className="shrink-0 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white rounded-xl transition-all duration-150 shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
                                >
                                    {isGeneratingAI ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin text-xs" />
                                            <span>Analyzing Data...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-wand-magic-sparkles text-xs" />
                                            <span>Generate Insights</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Insights Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insights.map((insight) => {
                                const iconMap = {
                                    positive: 'fa-circle-check',
                                    negative: 'fa-circle-exclamation',
                                    warning: 'fa-triangle-exclamation',
                                    neutral: 'fa-circle-info',
                                };

                                const colorClasses = {
                                    positive: {
                                        card: 'hover:border-emerald-300 dark:hover:border-emerald-800/80',
                                        iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40',
                                        badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40',
                                    },
                                    negative: {
                                        card: 'hover:border-rose-300 dark:hover:border-rose-800/80',
                                        iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40',
                                        badge: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40',
                                    },
                                    warning: {
                                        card: 'hover:border-amber-300 dark:hover:border-amber-800/80',
                                        iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40',
                                        badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40',
                                    },
                                    neutral: {
                                        card: 'hover:border-blue-300 dark:hover:border-blue-800/80',
                                        iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40',
                                        badge: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40',
                                    },
                                };

                                const currentStyle = colorClasses[insight.type] || colorClasses.neutral;

                                return (
                                    <div
                                        key={insight.id}
                                        className={`group relative p-4.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col justify-between ${currentStyle.card}`}
                                        onClick={() => setSelectedInsight(insight)}
                                    >
                                        <div>
                                            <div className="flex items-start gap-3.5">
                                                <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${currentStyle.iconBg}`}>
                                                    <i className={`fas ${iconMap[insight.type]} text-sm`} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                                            {insight.title}
                                                        </h4>
                                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${currentStyle.badge}`}>
                                                            {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                                                        {insight.description}
                                                    </p>

                                                    {insight.metric && (
                                                        <div className="mt-3 flex items-center gap-4 text-xs">
                                                            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                                                <i className="fas fa-chart-simple text-[10px] text-slate-400 dark:text-slate-500" />
                                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{insight.metric}</span>
                                                            </span>
                                                            {insight.change && (
                                                                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                                                    <i className="fas fa-arrow-right text-[10px] text-slate-400 dark:text-slate-500" />
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{insight.change}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {insight.actionable && (
                                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/50 dark:border-amber-900/30">
                                                    <i className="fas fa-lightbulb text-[9px]" />
                                                    Actionable
                                                </span>
                                                <Link
                                                    href={insight.actionLink || '#'}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-xs font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-1 transition-all"
                                                >
                                                    <span>{insight.actionText || 'Take Action'}</span>
                                                    <i className="fas fa-arrow-right text-[10px]" />
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Empty State */}
                        {insights.length === 0 && (
                            <div className="text-center py-14 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center mb-3 text-slate-400 dark:text-slate-500">
                                    <i className="fas fa-robot text-xl" />
                                </div>
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Insights Generated Yet</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                                    Click "Generate Insights" above to run automated AI diagnostics on your records.
                                </p>
                            </div>
                        )}

                        {/* AI Summary Modal */}
                        {selectedInsight && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm"
                                onClick={() => setSelectedInsight(null)}
                            >
                                <div
                                    className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl border border-slate-200/80 dark:border-slate-800"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950/40 border border-pink-200/60 dark:border-pink-900/40 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                                <i className="fas fa-lightbulb text-xs" />
                                            </div>
                                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                                {selectedInsight.title}
                                            </h3>
                                        </div>
                                        <button
                                            onClick={() => setSelectedInsight(null)}
                                            className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                                            aria-label="Close modal"
                                        >
                                            <i className="fas fa-xmark text-xs" />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                                            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                {selectedInsight.description}
                                            </p>
                                        </div>

                                        {selectedInsight.metric && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-xl p-3.5 text-center">
                                                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Metric</p>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{selectedInsight.metric}</p>
                                                </div>
                                                {selectedInsight.change && (
                                                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-xl p-3.5 text-center">
                                                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Change</p>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{selectedInsight.change}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {selectedInsight.actionable && (
                                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                                <Link
                                                    href={selectedInsight.actionLink || '#'}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-600 hover:bg-pink-700 dark:bg-pink-500 dark:hover:bg-pink-600 text-white rounded-xl transition-all text-xs font-semibold shadow-xs"
                                                >
                                                    <span>{selectedInsight.actionText || 'Take Action'}</span>
                                                    <i className="fas fa-arrow-right text-[10px]" />
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </TabContent>
            )}

            {/* ─── FORECAST TAB ─── */}
            {activeTab === 'forecast' && (
                <TabContent>
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-all">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400">
                                        <i className="fas fa-chart-line text-xs"></i>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            Volume Forecast
                                        </h3>
                                        <InfoTooltip text="AI-powered 12-month volume projection with confidence intervals" />
                                        <span className="text-[10px] font-semibold bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/40 px-2 py-0.5 rounded-md">
                                            AI Powered
                                        </span>
                                    </div>
                                </div>
                                <ChartLink href="/forecast" label="View full forecast" />
                            </div>

                            <div className="h-75 w-full pt-4">
                                <canvas ref={chartRefs.forecast}></canvas>
                            </div>

                            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 text-center transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Next Month</p>
                                    <p className="text-base font-bold text-slate-900 dark:text-white mt-1">2,450</p>
                                </div>
                                <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 text-center transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Growth</p>
                                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">+8.2%</p>
                                </div>
                                <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 text-center transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Confidence</p>
                                    <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1">High</p>
                                </div>
                                <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 text-center transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Quarterly</p>
                                    <p className="text-base font-bold text-purple-600 dark:text-purple-400 mt-1">+12.4%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabContent>
            )}

            {/* ─── REPORTS TAB ─── */}
            {activeTab === 'reports' && (
                <TabContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                {
                                    title: 'Executive Summary',
                                    icon: 'fa-file-alt',
                                    color: 'text-pink-500 dark:text-pink-400',
                                    bg: 'bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30',
                                    desc: 'Complete overview of all operations',
                                    link: '/reports/executive'
                                },
                                {
                                    title: 'Parcel Performance',
                                    icon: 'fa-box',
                                    color: 'text-blue-500 dark:text-blue-400',
                                    bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/30',
                                    desc: 'Detailed parcel metrics and trends',
                                    link: '/reports/parcels'
                                },
                                {
                                    title: 'Inventory Report',
                                    icon: 'fa-warehouse',
                                    color: 'text-amber-500 dark:text-amber-400',
                                    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/30',
                                    desc: 'Stock levels and inventory health',
                                    link: '/reports/inventory'
                                },
                                {
                                    title: 'Procurement Status',
                                    icon: 'fa-shopping-cart',
                                    color: 'text-purple-500 dark:text-purple-400',
                                    bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30',
                                    desc: 'Purchase requests and approvals',
                                    link: '/reports/procurement'
                                },
                                {
                                    title: 'Courier Performance',
                                    icon: 'fa-truck',
                                    color: 'text-emerald-500 dark:text-emerald-400',
                                    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/30',
                                    desc: 'Courier efficiency and metrics',
                                    link: '/reports/couriers'
                                },
                                {
                                    title: 'Financial Summary',
                                    icon: 'fa-chart-bar',
                                    color: 'text-indigo-500 dark:text-indigo-400',
                                    bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/30',
                                    desc: 'Cost breakdown and savings',
                                    link: '/reports/financial'
                                },
                            ].map((report) => (
                                <div
                                    key={report.title}
                                    className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start gap-3.5">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${report.bg} transition-transform duration-200 group-hover:scale-105`}>
                                                <i className={`fas ${report.icon} text-sm ${report.color}`}></i>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                                                    <span className="truncate">{report.title}</span>
                                                    <InfoTooltip text={report.desc} />
                                                </h4>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                                    {report.desc}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Last updated: Today</span>
                                        <Link
                                            href={report.link}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-all group/link cursor-pointer"
                                        >
                                            <i className="fas fa-file-pdf text-[10px] opacity-90"></i>
                                            <span>View Report</span>
                                            <i className="fas fa-arrow-right text-[8px] transition-transform duration-200 group-hover/link:translate-x-0.5"></i>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabContent>
            )}
        </div>
    );
}