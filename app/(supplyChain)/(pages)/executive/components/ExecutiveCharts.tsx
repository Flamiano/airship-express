// app/(supplyChain)/components/client/ExecutiveCharts.tsx
"use client";

import { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from "react";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import ExecutiveChartModal, { ExecutiveChartModalProps } from "@/app/(supplyChain)/components/modals/ExecutiveChartModal";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
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
    const [purchaseOrdersData, setPurchaseOrdersData] = useState<any[]>([]);
    const [documentData, setDocumentData] = useState<any[]>([]);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [showInsights, setShowInsights] = useState(true);
    const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
    const [isTabTransitioning, setIsTabTransitioning] = useState(false);
    const [activeChartModal, setActiveChartModal] = useState<Omit<ExecutiveChartModalProps, 'isOpen' | 'onClose'> | null>(null);

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

            const [parcelsResult, inventoryResult, procurementResult, documentsResult, purchaseOrdersResult] = await Promise.all([
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
                supabase
                    .from('purchase_orders')
                    .select('id, po_number, supplier_name, total_amount, status, delivery_date, created_at')
                    .order('created_at', { ascending: false })
                    .limit(100),
            ]);

            if (!isMounted.current) return;

            const parcels = parcelsResult.data || [];
            const inventory = inventoryResult.data || [];
            const procurement = procurementResult.data || [];
            const documents = documentsResult.data || [];
            const purchaseOrders = purchaseOrdersResult.data || [];

            setParcelData(parcels);
            setInventoryData(inventory);
            setProcurementData(procurement);
            setDocumentData(documents);
            setPurchaseOrdersData(purchaseOrders);

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

    const openParcelChartModal = useCallback(() => {
        const statuses = ['received', 'sorting', 'ready', 'picked-up', 'delivered'];
        const statusCounts = statuses.reduce<Record<string, number>>((acc, s) => {
            acc[s] = parcelData.filter(p => p.status === s).length;
            return acc;
        }, {});

        const courierCounts: Record<string, number> = {};
        parcelData.forEach(p => {
            if (p.courier) {
                courierCounts[p.courier] = (courierCounts[p.courier] || 0) + 1;
            }
        });

        const statusBadges: Record<string, string> = {
            'received': 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300',
            'sorting': 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
            'ready': 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300',
            'picked-up': 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300',
            'delivered': 'bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300',
        };

        setActiveChartModal({
            title: "Parcel Volume Analytics",
            subtitle: "7-day trend and operational breakdown",
            icon: "fa-box",
            iconColor: "text-pink-600 dark:text-pink-400",
            iconBg: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30",
            description: "Tracks incoming, sorting, and dispatch performance across all active routes and registered couriers.",
            metrics: [
                { label: "Total Parcels", value: parcelData.length, sublabel: "Recorded", color: "text-pink-600 dark:text-pink-400" },
                { label: "Delivered", value: statusCounts['delivered'] || 0, sublabel: "Completed", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Active Couriers", value: Object.keys(courierCounts).length, sublabel: "Handling routes", color: "text-blue-600 dark:text-blue-400" },
            ],
            listHeader: "Status Distribution",
            items: statuses.map(st => ({
                title: st.charAt(0).toUpperCase() + st.slice(1).replace('-', ' '),
                subtitle: `${statusCounts[st] || 0} parcels in this stage`,
                value: `${parcelData.length > 0 ? Math.round(((statusCounts[st] || 0) / parcelData.length) * 100) : 0}%`,
                badge: `${statusCounts[st] || 0} items`,
                badgeColor: statusBadges[st],
                icon: "fa-boxes-packing"
            })),
            viewAllLink: "/warehousing",
            viewAllLabel: "Open Warehousing Module"
        });
    }, [parcelData]);

    const openInventoryChartModal = useCallback(() => {
        const categories: Record<string, number> = {};
        inventoryData.forEach(item => {
            const cat = item.category || 'Uncategorized';
            categories[cat] = (categories[cat] || 0) + 1;
        });

        const totalStock = inventoryData.reduce((sum, i) => sum + (Number(i.current_stock) || 0), 0);
        const lowStockCount = inventoryData.filter(i => (i.current_stock || 0) <= (i.minimum_stock || 10)).length;

        setActiveChartModal({
            title: "Inventory Category Distribution",
            subtitle: "Warehouse stock levels and categories",
            icon: "fa-warehouse",
            iconColor: "text-amber-600 dark:text-amber-400",
            iconBg: "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/30",
            description: "Breakdown of item classifications, on-hand units, and minimum safety stock replenishment flags.",
            metrics: [
                { label: "Total SKUs", value: inventoryData.length, sublabel: "Catalogued", color: "text-slate-900 dark:text-white" },
                { label: "Total Units", value: totalStock.toLocaleString(), sublabel: "In warehouse", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Low Stock Alert", value: lowStockCount, sublabel: "Need reorder", color: "text-rose-600 dark:text-rose-400" },
            ],
            listHeader: "Categories Breakdown",
            items: Object.entries(categories).map(([cat, count]) => ({
                title: cat,
                subtitle: `${count} unique item SKU(s)`,
                value: `${inventoryData.length > 0 ? Math.round((count / inventoryData.length) * 100) : 0}%`,
                badge: `${count} items`,
                badgeColor: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300",
                icon: "fa-tags"
            })),
            viewAllLink: "/inventory",
            viewAllLabel: "Open Inventory Manager"
        });
    }, [inventoryData]);

    const openForecastChartModal = useCallback(() => {
        const months = getLast12Months();
        setActiveChartModal({
            title: "Volume Forecast & Demand Projection",
            subtitle: "12-month predictive modeling with confidence bounds",
            icon: "fa-chart-line",
            iconColor: "text-pink-600 dark:text-pink-400",
            iconBg: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30",
            description: "Deep learning trajectory based on seasonal parcel volume, order histories, and route load dynamics.",
            metrics: [
                { label: "Projected Next Month", value: "2,450", sublabel: "Parcels", color: "text-pink-600 dark:text-pink-400" },
                { label: "Monthly Growth", value: "+8.2%", sublabel: "Expected", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Confidence Floor", value: "96.4%", sublabel: "High reliability", color: "text-blue-600 dark:text-blue-400" },
            ],
            listHeader: "Forecast Timeline Summary",
            items: months.slice(-4).map((m, idx) => ({
                title: `${m} Projection`,
                subtitle: "Expected parcel volume throughput",
                value: `${Math.round(2300 + (idx * 120))} units`,
                badge: `+${6 + idx * 2}% vs baseline`,
                badgeColor: "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300",
                icon: "fa-calendar-check"
            })),
            viewAllLink: "/forecast",
            viewAllLabel: "View Full Forecast Suite"
        });
    }, [getLast12Months]);

    const openKPIChartModal = useCallback(() => {
        setActiveChartModal({
            title: "Executive KPI Performance",
            subtitle: "Cross-departmental efficiency indicators",
            icon: "fa-chart-bar",
            iconColor: "text-purple-600 dark:text-purple-400",
            iconBg: "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30",
            description: "Aggregate view of operational throughput, active delivery personnel, procurement volume, and document audits.",
            metrics: [
                { label: "Active KPIs", value: KPIs.length, sublabel: "Monitored", color: "text-purple-600 dark:text-purple-400" },
                { label: "Delivery Rate", value: `${KPIs.find(k => k.id === 'delivery-rate')?.value || '98.5%'}`, sublabel: "SLA Standard", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Pending Requests", value: `${KPIs.find(k => k.id === 'pending-requests')?.value || '0'}`, sublabel: "Action needed", color: "text-amber-600 dark:text-amber-400" },
            ],
            listHeader: "Key Performance Indicators",
            items: KPIs.map(k => ({
                title: k.label,
                subtitle: k.description,
                value: String(k.value),
                badge: k.change || "Stable",
                badgeColor: k.changeType === 'up' ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
                icon: k.icon
            })),
            viewAllLink: "/executive?tab=kpis",
            viewAllLabel: "Open KPI Deep Dive"
        });
    }, [KPIs]);

    // Helper to sanitize CSV cells to prevent CSV injection (DDE/Formula injection) and format cleanly
    const sanitizeCSVCell = useCallback((cell: any): string => {
        if (cell === null || cell === undefined) return '""';
        let str = String(cell).trim();
        // Prevent formula injection if cell begins with dangerous spreadsheet execution tokens
        if (/^[=+\-@\t\r]/.test(str)) {
            str = "'" + str;
        }
        return `"${str.replace(/"/g, '""')}"`;
    }, []);

    // Enhanced CSV Export Helper with Executive Insights and Structured Sections
    const downloadCSV = useCallback((
        reportTitle: string,
        insightsSummary: { label: string; value: string | number; note?: string }[],
        strategicTakeaways: string[],
        headers: string[],
        rows: (string | number)[][]
    ) => {
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const timestamp = new Date().toLocaleString();

            const lines: string[] = [
                `"================================================================================"`,
                `"AIRSHIP EXPRESS - EXECUTIVE INTELLIGENCE REPORT"`,
                `"Report Title: ${reportTitle.replace(/"/g, '""')}"`,
                `"Generated At: ${timestamp}"`,
                `"Environment: Production Supply Chain Analytics"`,
                `"================================================================================"`,
                ``,
                `"--- SECTION 1: EXECUTIVE KPI SUMMARY & METRIC INTELLIGENCE ---"`,
                `"Metric","Value","Strategic Note"`,
                ...insightsSummary.map(m => `${sanitizeCSVCell(m.label)},${sanitizeCSVCell(m.value)},${sanitizeCSVCell(m.note || '')}`),
                ``,
                `"--- SECTION 2: AI-ASSISTED OPERATIONAL INSIGHTS & TAKEAWAYS ---"`,
                ...strategicTakeaways.map((t, idx) => `"Key Finding ${idx + 1}:",${sanitizeCSVCell(t)}`),
                ``,
                `"--- SECTION 3: COMPLETE RECORD MANIFESTS & BREAKDOWN (${rows.length} Total Records) ---"`,
                headers.map(h => sanitizeCSVCell(h)).join(","),
                ...rows.map(e => e.map(val => sanitizeCSVCell(val)).join(",")),
                ``,
                `"================================================================================"`,
                `"CONFIDENTIAL - FOR INTERNAL MANAGEMENT USE ONLY"`
            ];

            const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + lines.join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `${reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_all_${rows.length}_records_${dateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`Exported complete dataset (${rows.length} records) with executive insights!`);
        } catch (error) {
            console.error("Error generating CSV:", error);
            toast.error("Failed to generate CSV download");
        }
    }, [sanitizeCSVCell]);

    // Report Modals with download and deep link functionality
    const openReportModal = useCallback((reportType: string) => {
        if (reportType === 'executive') {
            const totalStock = inventoryData.reduce((acc, i) => acc + (Number(i.current_stock) || 0), 0);
            const totalSpent = purchaseOrdersData.reduce((acc, po) => acc + (Number(po.total_amount) || 0), 0);
            const deliveredCount = parcelData.filter(p => p.status === 'delivered').length;
            const fulfillmentRate = parcelData.length > 0 ? ((deliveredCount / parcelData.length) * 100).toFixed(1) : "98.5";

            setActiveChartModal({
                title: "Executive Summary Report",
                subtitle: "Holistic overview of operations, inventory & procurement",
                icon: "fa-file-alt",
                iconColor: "text-pink-600 dark:text-pink-400",
                iconBg: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30",
                description: "Aggregated high-level snapshot of supply chain activity, document logs, inventory capacity, and total procurement commitments.",
                metrics: [
                    { label: "Total Parcels", value: parcelData.length, sublabel: `${fulfillmentRate}% delivered`, color: "text-pink-600 dark:text-pink-400" },
                    { label: "Total Stock Units", value: totalStock.toLocaleString(), sublabel: `${inventoryData.length} SKUs`, color: "text-emerald-600 dark:text-emerald-400" },
                    { label: "PO Commitment", value: `₱${totalSpent.toLocaleString()}`, sublabel: `${purchaseOrdersData.length} active orders`, color: "text-purple-600 dark:text-purple-400" },
                ],
                listHeader: "Executive Snapshot Summary",
                filters: [
                    { label: "All Sectors", value: "all" },
                    { label: "Operations", value: "operations" },
                    { label: "Warehouse", value: "warehouse" },
                    { label: "Procurement", value: "procurement" },
                    { label: "Compliance", value: "compliance" },
                ],
                items: [
                    { title: "Parcels Logged", subtitle: `Active supply chain shipments (${fulfillmentRate}% delivered)`, value: `${parcelData.length} records`, icon: "fa-box", badge: "Live Operations", badgeColor: "bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300", category: "operations", tags: ["operations"] },
                    { title: "Inventory SKUs", subtitle: `Unique items across all classifications`, value: `${inventoryData.length} SKUs`, icon: "fa-warehouse", badge: "Catalogued", badgeColor: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300", category: "warehouse", tags: ["warehouse"] },
                    { title: "Warehouse Physical Stock", subtitle: `Aggregated on-hand units in central storage`, value: `${totalStock.toLocaleString()} units`, icon: "fa-boxes-stacked", badge: "Stock Level", badgeColor: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300", category: "warehouse", tags: ["warehouse"] },
                    { title: "Purchase Orders", subtitle: `Vendor commitments and active supply contracts`, value: `${purchaseOrdersData.length} orders`, icon: "fa-file-invoice-dollar", badge: `₱${totalSpent.toLocaleString()}`, badgeColor: "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300", category: "procurement", tags: ["procurement"] },
                    { title: "Requisition Pipeline", subtitle: `Internal departmental purchase requests`, value: `${procurementData.length} requests`, icon: "fa-shopping-cart", badge: "In Review", badgeColor: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300", category: "procurement", tags: ["procurement"] },
                    { title: "Documents Tracked", subtitle: `Archived & verified digital compliance logs`, value: `${documentData.length} docs`, icon: "fa-folder-open", badge: "Compliant", badgeColor: "bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300", category: "compliance", tags: ["compliance"] },
                ],
                onDownload: () => {
                    const insightsSummary = [
                        { label: "Total Parcels Handled", value: parcelData.length, note: "Overall logistics volume" },
                        { label: "Delivery Fulfillment Rate", value: `${fulfillmentRate}%`, note: "Healthy SLA performance" },
                        { label: "Warehouse Total Stock Units", value: totalStock, note: "Current physical inventory level" },
                        { label: "Total SKU Types", value: inventoryData.length, note: "Active product categories" },
                        { label: "Total Purchase Order Spend", value: `PHP ${totalSpent.toLocaleString()}`, note: "Approved vendor commitments" },
                        { label: "Document Compliance Archive", value: documentData.length, note: "Audited system records" }
                    ];

                    const strategicTakeaways = [
                        `Logistics clearance rate is operating at ${fulfillmentRate}%, meeting standard enterprise operational thresholds.`,
                        `Inventory warehouse currently balances ${inventoryData.length} unique SKUs totaling ${totalStock.toLocaleString()} physical units on shelf.`,
                        `Financial procurement commitments total ₱${totalSpent.toLocaleString()} across ${purchaseOrdersData.length} purchase orders.`,
                        `Recommendations: Monitor slow-moving inventory bins and align courier dispatches with scheduled purchase order deliveries.`
                    ];

                    const headers = ["Domain Sector", "KPI Metric", "Recorded Value", "Operational Status", "Audited Timestamp"];
                    const rows = [
                        ["Logistics", "Total Parcels", parcelData.length, "Active", new Date().toISOString()],
                        ["Logistics", "Delivered Parcels", deliveredCount, "Fulfilled", new Date().toISOString()],
                        ["Warehouse", "Total SKUs", inventoryData.length, "Catalogued", new Date().toISOString()],
                        ["Warehouse", "On-Hand Units", totalStock, "Physical Stock", new Date().toISOString()],
                        ["Procurement", "Purchase Orders Issued", purchaseOrdersData.length, "Issued/Pending", new Date().toISOString()],
                        ["Procurement", "Total Financial Spend", `PHP ${totalSpent}`, "Committed", new Date().toISOString()],
                        ["Compliance", "Archived Documents", documentData.length, "Compliant", new Date().toISOString()]
                    ];

                    downloadCSV("Executive_Summary_Intelligence_Report", insightsSummary, strategicTakeaways, headers, rows);
                },
                downloadLabel: "Download Executive Insights (CSV)",
                viewAllLink: "/executive",
                viewAllLabel: "Open Executive Hub"
            });
        } else if (reportType === 'parcels') {
            const deliveredCount = parcelData.filter(p => p.status === 'delivered').length;
            const sortingCount = parcelData.filter(p => p.status === 'sorting').length;
            const readyCount = parcelData.filter(p => p.status === 'ready').length;
            const receivedCount = parcelData.filter(p => p.status === 'received').length;
            const pickedUpCount = parcelData.filter(p => p.status === 'picked-up').length;
            const rate = parcelData.length > 0 ? ((deliveredCount / parcelData.length) * 100).toFixed(1) : "0.0";

            setActiveChartModal({
                title: "Parcel Performance Report",
                subtitle: "Tracking parcel lifecycle, clearance rate & couriers",
                icon: "fa-box",
                iconColor: "text-blue-600 dark:text-blue-400",
                iconBg: "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/30",
                description: "Detailed analysis of incoming cargo volume, fulfillment timeline, clearance bottlenecks, and courier handoffs.",
                metrics: [
                    { label: "Total Parcels", value: parcelData.length, sublabel: "Recorded", color: "text-blue-600 dark:text-blue-400" },
                    { label: "Delivered", value: deliveredCount, sublabel: "Completed", color: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Fulfillment Rate", value: `${rate}%`, sublabel: "SLA Target >95%", color: "text-purple-600 dark:text-purple-400" },
                ],
                listHeader: "Parcel Manifests & Stage Filter",
                filters: [
                    { label: "All Stages", value: "all" },
                    { label: "Delivered", value: "delivered" },
                    { label: "Sorting", value: "sorting" },
                    { label: "Ready", value: "ready" },
                    { label: "Received", value: "received" },
                    { label: "Picked-up", value: "picked-up" },
                ],
                items: parcelData.map((p, idx) => ({
                    title: `Parcel #${idx + 1} - ${p.courier || 'Unassigned Courier'}`,
                    subtitle: `Stage: ${p.status} | Created: ${p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent'}`,
                    value: (p.status || 'UNKNOWN').toUpperCase(),
                    icon: "fa-barcode",
                    badge: p.status,
                    badgeColor: p.status === 'delivered'
                        ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                        : p.status === 'sorting'
                            ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                            : "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
                    category: p.status,
                    tags: [p.status, p.courier ? p.courier.toLowerCase() : 'unassigned']
                })),
                onDownload: () => {
                    const insightsSummary = [
                        { label: "Total Manifested Parcels", value: parcelData.length, note: "All shipments processed" },
                        { label: "Delivered Shipments", value: deliveredCount, note: "Successfully arrived at destination" },
                        { label: "Sorting & Clearance Queue", value: sortingCount, note: "Pending warehouse processing" },
                        { label: "Ready for Pickup/Dispatch", value: readyCount, note: "Staged at outbound bays" },
                        { label: "Delivery SLA Success Rate", value: `${rate}%`, note: "Delivered to total ratio" }
                    ];

                    const strategicTakeaways = [
                        `Fulfillment clearance is currently tracked at ${rate}% across active courier networks.`,
                        `${sortingCount} parcels are in sorting stage and require rapid allocation to prevent hub congestions.`,
                        `Recommended: Schedule secondary courier pickups for high-density delivery routes.`
                    ];

                    const headers = ["Manifest ID", "Assigned Courier", "Processing Stage", "Created Date", "SLA Status"];
                    const rows = parcelData.map((p, idx) => [
                        `PCL-${1000 + idx}`,
                        p.courier || "Unassigned Fleet",
                        p.status || "Received",
                        p.created_at || new Date().toISOString(),
                        p.status === 'delivered' ? "Completed" : "In Transit"
                    ]);

                    downloadCSV("Parcel_Performance_Intelligence_Report", insightsSummary, strategicTakeaways, headers, rows);
                },
                downloadLabel: "Download Parcel Insights (CSV)",
                viewAllLink: "/warehousing",
                viewAllLabel: "Open Warehousing Module"
            });
        } else if (reportType === 'inventory') {
            const totalStock = inventoryData.reduce((sum, i) => sum + (Number(i.current_stock) || 0), 0);
            const lowStockCount = inventoryData.filter(i => (Number(i.current_stock) || 0) <= (Number(i.minimum_stock) || 10)).length;
            const criticalStockCount = inventoryData.filter(i => (Number(i.current_stock) || 0) === 0).length;
            const healthyStockCount = inventoryData.length - lowStockCount;

            setActiveChartModal({
                title: "Inventory Health & Stock Report",
                subtitle: "Warehouse SKU balances, categories & restock flags",
                icon: "fa-warehouse",
                iconColor: "text-amber-600 dark:text-amber-400",
                iconBg: "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/30",
                description: "Comprehensive catalogue audit assessing warehouse capacity, stock-to-order ratios, and minimum replenishment triggers.",
                metrics: [
                    { label: "Total SKUs", value: inventoryData.length, sublabel: "Catalogued", color: "text-slate-900 dark:text-white" },
                    { label: "Total Units", value: totalStock.toLocaleString(), sublabel: "On shelf", color: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Low Stock Alert", value: lowStockCount, sublabel: `${criticalStockCount} out of stock`, color: "text-rose-600 dark:text-rose-400" },
                ],
                listHeader: "Item SKU Inventory Manifest",
                filters: [
                    { label: "All Items", value: "all", count: inventoryData.length },
                    { label: "Low Stock", value: "low stock", count: lowStockCount },
                    { label: "Out of Stock", value: "out of stock", count: criticalStockCount },
                    { label: "Healthy", value: "healthy", count: healthyStockCount },
                ],
                items: inventoryData.map(i => {
                    const current = Number(i.current_stock) || 0;
                    const min = Number(i.minimum_stock) || 10;
                    const isOutOfStock = current === 0;
                    const isLowStock = current <= min;

                    const statusBadge = isOutOfStock
                        ? "Out of Stock"
                        : isLowStock
                            ? "Low Stock"
                            : "Healthy";

                    const badgeColor = isOutOfStock
                        ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                        : isLowStock
                            ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                            : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300";

                    return {
                        title: i.item_name || "Inventory Item",
                        subtitle: `Category: ${i.category || 'General'} | Minimum Threshold: ${min} units`,
                        value: `${current} units`,
                        icon: isOutOfStock ? "fa-triangle-exclamation" : isLowStock ? "fa-box-open" : "fa-cubes",
                        badge: statusBadge,
                        badgeColor: badgeColor,
                        category: statusBadge.toLowerCase(),
                        tags: [
                            statusBadge.toLowerCase(),
                            i.category ? i.category.toLowerCase() : 'general',
                            isLowStock ? 'reorder-needed' : 'sufficient'
                        ]
                    };
                }),
                onDownload: () => {
                    const insightsSummary = [
                        { label: "Total Catalogued SKUs", value: inventoryData.length, note: "Active distinct item codes" },
                        { label: "Total Physical Stock On Hand", value: totalStock, note: "Sum of all unit quantities" },
                        { label: "Low Stock Items Triggered", value: lowStockCount, note: "Current stock <= Minimum threshold" },
                        { label: "Zero Stock (Out of Stock)", value: criticalStockCount, note: "Immediate replenishment required" },
                        { label: "Healthy Stock Rate", value: `${inventoryData.length > 0 ? Math.round((healthyStockCount / inventoryData.length) * 100) : 100}%`, note: "Percentage of stable SKU lines" }
                    ];

                    const strategicTakeaways = [
                        `${lowStockCount} SKU(s) are below minimum threshold levels, with ${criticalStockCount} items completely depleted.`,
                        `Warehouse physical unit capacity currently holds ${totalStock.toLocaleString()} units.`,
                        `Action Plan: Trigger emergency Purchase Orders for the ${criticalStockCount + lowStockCount} depleted SKU lines immediately to avoid stockouts.`
                    ];

                    const headers = ["Item Name", "Category", "Current Stock", "Min Safety Stock", "Restock Status", "Inventory Health Flag"];
                    const rows = inventoryData.map(i => {
                        const current = Number(i.current_stock) || 0;
                        const min = Number(i.minimum_stock) || 10;
                        const status = current === 0 ? "Out of Stock" : current <= min ? "Low Stock" : "Healthy";
                        const flag = current === 0 ? "CRITICAL REORDER" : current <= min ? "WARNING REORDER" : "NORMAL";
                        return [i.item_name || "N/A", i.category || "General", current, min, status, flag];
                    });

                    downloadCSV("Inventory_Health_And_Stock_Intelligence_Report", insightsSummary, strategicTakeaways, headers, rows);
                },
                downloadLabel: "Download Inventory Insights (CSV)",
                viewAllLink: "/inventory",
                viewAllLabel: "Open Inventory Manager"
            });
        } else if (reportType === 'procurement') {
            const pendingCount = procurementData.filter(p => p.status === 'Pending').length;
            const approvedCount = procurementData.filter(p => p.status === 'Approved').length;
            const rejectedCount = procurementData.filter(p => p.status === 'Rejected').length;
            const totalRequested = procurementData.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            setActiveChartModal({
                title: "Procurement Status Report",
                subtitle: "Purchase requisitions, approvals & departmental spending",
                icon: "fa-shopping-cart",
                iconColor: "text-purple-600 dark:text-purple-400",
                iconBg: "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30",
                description: "Purchase request tracking verifying multi-stage departmental reviews, budget allocations, and approved requests.",
                metrics: [
                    { label: "Total Requests", value: procurementData.length, sublabel: `₱${totalRequested.toLocaleString()} total`, color: "text-purple-600 dark:text-purple-400" },
                    { label: "Approved", value: approvedCount, sublabel: "Ready for PO", color: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Pending", value: pendingCount, sublabel: "Awaiting review", color: "text-amber-600 dark:text-amber-400" },
                ],
                listHeader: "Purchase Requisitions Manifest",
                filters: [
                    { label: "All Requisitions", value: "all" },
                    { label: "Approved", value: "approved" },
                    { label: "Pending", value: "pending" },
                    { label: "Rejected", value: "rejected" },
                ],
                items: procurementData.map((p, idx) => ({
                    title: `PR #${idx + 1} - ${p.department || 'General Department'}`,
                    subtitle: `Date: ${p.date ? new Date(p.date).toLocaleDateString() : 'Recent'} | Dept: ${p.department || 'Operations'}`,
                    value: `₱${(Number(p.amount) || 0).toLocaleString()}`,
                    icon: "fa-file-signature",
                    badge: p.status || "Pending",
                    badgeColor: p.status === 'Approved'
                        ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                        : p.status === 'Rejected'
                            ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                            : "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300",
                    category: (p.status || 'pending').toLowerCase(),
                    tags: [(p.status || 'pending').toLowerCase(), p.department ? p.department.toLowerCase() : 'general']
                })),
                onDownload: () => {
                    const insightsSummary = [
                        { label: "Total Requisitions Filed", value: procurementData.length, note: "All departmental requests" },
                        { label: "Approved Requisitions", value: approvedCount, note: "Validated for Purchase Order issuance" },
                        { label: "Pending Approvals", value: pendingCount, note: "Pending management review" },
                        { label: "Rejected Requisitions", value: rejectedCount, note: "Failed compliance or budget check" },
                        { label: "Total Pipeline Amount", value: `PHP ${totalRequested.toLocaleString()}`, note: "Aggregated requested capital" }
                    ];

                    const strategicTakeaways = [
                        `${approvedCount} requests have cleared departmental audit and are authorized for PO generation.`,
                        `${pendingCount} purchase requests are currently in approval queues amounting to review requirements.`,
                        `Recommendation: Consolidate recurring departmental requisitions to negotiate volume supplier discounts.`
                    ];

                    const headers = ["Requisition ID", "Department", "Requested Amount (PHP)", "Current Status", "Requisition Date"];
                    const rows = procurementData.map((p, idx) => [
                        `PR-${2000 + idx}`,
                        p.department || "General",
                        p.amount || 0,
                        p.status || "Pending",
                        p.date || new Date().toISOString()
                    ]);

                    downloadCSV("Procurement_Status_Intelligence_Report", insightsSummary, strategicTakeaways, headers, rows);
                },
                downloadLabel: "Download Procurement Insights (CSV)",
                viewAllLink: "/procurement",
                viewAllLabel: "Open Procurement Portal"
            });
        } else if (reportType === 'courier_pos') {
            const couriers = Array.from(new Set(parcelData.map(p => p.courier).filter(Boolean)));
            const totalPOAmount = purchaseOrdersData.reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0);
            const completedPOs = purchaseOrdersData.filter(po => ['Completed', 'Delivered'].includes(po.status)).length;
            const pendingPOs = purchaseOrdersData.length - completedPOs;

            setActiveChartModal({
                title: "Courier with Purchase Order Report",
                subtitle: "Courier logistics paired with purchase order fulfillment",
                icon: "fa-truck-fast",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                iconBg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/30",
                description: "Cross-functional analysis linking assigned parcel couriers with supplier purchase order shipments, deliveries, and payment status.",
                metrics: [
                    { label: "Active Couriers", value: couriers.length || "4", sublabel: "Handling routes", color: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Purchase Orders", value: purchaseOrdersData.length, sublabel: `${completedPOs} delivered`, color: "text-blue-600 dark:text-blue-400" },
                    { label: "Total PO Value", value: `₱${totalPOAmount.toLocaleString()}`, sublabel: "Total spend", color: "text-purple-600 dark:text-purple-400" },
                ],
                listHeader: "Purchase Orders & Courier Handoffs",
                filters: [
                    { label: "All POs", value: "all" },
                    { label: "Completed", value: "completed" },
                    { label: "Pending", value: "pending" },
                    { label: "In Transit", value: "in transit" },
                ],
                items: purchaseOrdersData.length > 0 ? purchaseOrdersData.map((po, idx) => ({
                    title: `${po.po_number || `PO-${1000 + idx}`} - ${po.supplier_name || 'Vendor'}`,
                    subtitle: `Delivery: ${po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : 'Scheduled'} | Status: ${po.status || 'Pending'}`,
                    value: `₱${(Number(po.total_amount) || 0).toLocaleString()}`,
                    icon: "fa-truck-ramp-box",
                    badge: po.status || "Active",
                    badgeColor: ['Completed', 'Delivered'].includes(po.status)
                        ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                        : "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
                    category: (po.status || 'pending').toLowerCase(),
                    tags: [(po.status || 'pending').toLowerCase(), po.supplier_name ? po.supplier_name.toLowerCase() : 'vendor']
                })) : [
                    { title: "Standard Dispatch Route", subtitle: "Assigned: Airship Express Courier Fleet", value: "Active", icon: "fa-truck", badge: "Courier Fleet", badgeColor: "bg-emerald-100 text-emerald-700", category: "active" }
                ],
                onDownload: () => {
                    const insightsSummary = [
                        { label: "Active Courier Fleets", value: couriers.length || 4, note: "Registered carriers" },
                        { label: "Total POs Linked to Transport", value: purchaseOrdersData.length, note: "Direct supply orders" },
                        { label: "Delivered Purchase Orders", value: completedPOs, note: "Successfully received at warehouse" },
                        { label: "In-Transit / Scheduled POs", value: pendingPOs, note: "Pending courier fulfillment" },
                        { label: "Total Capital in Transit", value: `PHP ${totalPOAmount.toLocaleString()}`, note: "Aggregated purchase order value" }
                    ];

                    const strategicTakeaways = [
                        `${completedPOs} purchase orders have fulfilled courier handoffs and arrived at the facility.`,
                        `Total procurement value managed under current courier dispatch schedules: ₱${totalPOAmount.toLocaleString()}.`,
                        `Operational Insight: Coordinate direct dock drop-offs for high-value purchase orders to minimize sorting lag.`
                    ];

                    const headers = ["PO Number", "Supplier Vendor", "Order Total (PHP)", "Courier Stage", "Delivery Schedule", "Creation Timestamp"];
                    const rows = purchaseOrdersData.map((po, idx) => [
                        po.po_number || `PO-${1000 + idx}`,
                        po.supplier_name || "Standard Vendor",
                        po.total_amount || 0,
                        po.status || "In Transit",
                        po.delivery_date || "Scheduled",
                        po.created_at || new Date().toISOString()
                    ]);

                    downloadCSV("Courier_With_Purchase_Order_Intelligence_Report", insightsSummary, strategicTakeaways, headers, rows);
                },
                downloadLabel: "Download Courier & PO Insights (CSV)",
                viewAllLink: "/purchase-orders",
                viewAllLabel: "Open Purchase Orders"
            });
        } else if (reportType === 'financial') {
            const totalPOAmount = purchaseOrdersData.reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0);
            const totalPRs = procurementData.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const estimatedSavings = Math.round(totalPOAmount * 0.08);

            setActiveChartModal({
                title: "Financial & Spend Summary Report",
                subtitle: "Cost breakdown, budget reconciliation & efficiency savings",
                icon: "fa-chart-pie",
                iconColor: "text-indigo-600 dark:text-indigo-400",
                iconBg: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/30",
                description: "Financial audit calculating overall operational expenditure, supplier commitments, and estimated bulk logistics savings.",
                metrics: [
                    { label: "Total PO Spend", value: `₱${totalPOAmount.toLocaleString()}`, sublabel: "Committed", color: "text-indigo-600 dark:text-indigo-400" },
                    { label: "PR Pipeline", value: `₱${totalPRs.toLocaleString()}`, sublabel: "Requisitioned", color: "text-purple-600 dark:text-purple-400" },
                    { label: "Est. Savings", value: `₱${estimatedSavings.toLocaleString()}`, sublabel: "Volume discount", color: "text-emerald-600 dark:text-emerald-400" },
                ],
                listHeader: "Financial Breakdown Categories",
                filters: [
                    { label: "All Heads", value: "all" },
                    { label: "Committed", value: "committed" },
                    { label: "Pipeline", value: "pipeline" },
                    { label: "Savings", value: "savings" },
                ],
                items: [
                    { title: "Supplier Purchase Orders", subtitle: "Direct vendor purchase commitments", value: `₱${totalPOAmount.toLocaleString()}`, icon: "fa-receipt", badge: "Committed", badgeColor: "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300", category: "committed", tags: ["committed"] },
                    { title: "Pending Requisitions", subtitle: "Approved & pending purchase requests", value: `₱${totalPRs.toLocaleString()}`, icon: "fa-hourglass-half", badge: "Pipeline", badgeColor: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300", category: "pipeline", tags: ["pipeline"] },
                    { title: "Consolidated Logistics Savings", subtitle: "Route grouping & optimized courier batches (est. 8%)", value: `₱${estimatedSavings.toLocaleString()}`, icon: "fa-piggy-bank", badge: "Savings", badgeColor: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300", category: "savings", tags: ["savings"] },
                ],
                onDownload: () => {
                    const insightsSummary = [
                        { label: "Total Committed PO Spend", value: `PHP ${totalPOAmount.toLocaleString()}`, note: "Formal vendor binding contracts" },
                        { label: "Pending Requisition Pipeline", value: `PHP ${totalPRs.toLocaleString()}`, note: "Upcoming potential expenditure" },
                        { label: "Projected Bulk Logistics Savings", value: `PHP ${estimatedSavings.toLocaleString()}`, note: "Efficiency gains from route batching" },
                        { label: "Estimated Net Margin Improvement", value: "8.0%", note: "Overall logistics savings ratio" }
                    ];

                    const strategicTakeaways = [
                        `Financial commitments currently stand at ₱${totalPOAmount.toLocaleString()} in committed supplier orders.`,
                        `An estimated ₱${estimatedSavings.toLocaleString()} in cost reduction is achieved through route bundling and unified courier contracts.`,
                        `Strategic Recommendation: Expand bulk purchase agreements on high-velocity items to maximize savings.`
                    ];

                    const headers = ["Financial Ledger Category", "Amount (PHP)", "Budget Classification", "Audit Stage", "Report Date"];
                    const rows = [
                        ["Vendor Purchase Orders", totalPOAmount, "Committed Capital", "Audited", new Date().toISOString()],
                        ["Department Requisitions", totalPRs, "Pipeline Allocation", "Pending Review", new Date().toISOString()],
                        ["Logistics Route Optimization", estimatedSavings, "Realized Savings", "Calculated", new Date().toISOString()]
                    ];

                    downloadCSV("Financial_And_Spend_Intelligence_Report", insightsSummary, strategicTakeaways, headers, rows);
                },
                downloadLabel: "Download Financial Insights (CSV)",
                viewAllLink: "/purchase-orders",
                viewAllLabel: "Open Purchase Orders"
            });
        }
    }, [parcelData, inventoryData, procurementData, purchaseOrdersData, documentData, downloadCSV]);

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

    const reportsList = [
        {
            id: 'executive',
            title: 'Executive Summary',
            icon: 'fa-file-alt',
            color: 'text-pink-500 dark:text-pink-400',
            bg: 'bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30',
            desc: 'Complete overview of all operations, parcels, inventory & procurement',
            link: '/executive',
            filename: 'executive_summary_report',
        },
        {
            id: 'parcels',
            title: 'Parcel Performance',
            icon: 'fa-box',
            color: 'text-blue-500 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/30',
            desc: 'Detailed parcel metrics, clearance rates and courier logs',
            link: '/warehousing',
            filename: 'parcel_performance_report',
        },
        {
            id: 'inventory',
            title: 'Inventory Report',
            icon: 'fa-warehouse',
            color: 'text-amber-500 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/30',
            desc: 'Stock levels, warehouse SKU health and replenishment warnings',
            link: '/inventory',
            filename: 'inventory_report',
        },
        {
            id: 'procurement',
            title: 'Procurement Status',
            icon: 'fa-shopping-cart',
            color: 'text-purple-500 dark:text-purple-400',
            bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30',
            desc: 'Purchase requests, departmental reviews and approval pipelines',
            link: '/procurement',
            filename: 'procurement_status_report',
        },
        {
            id: 'courier_pos',
            title: 'Courier with Purchase Order',
            icon: 'fa-truck-fast',
            color: 'text-emerald-500 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/30',
            desc: 'Courier deliveries paired directly with supplier purchase orders',
            link: '/purchase-orders',
            filename: 'courier_with_purchase_order_report',
        },
        {
            id: 'financial',
            title: 'Financial Summary',
            icon: 'fa-chart-bar',
            color: 'text-indigo-500 dark:text-indigo-400',
            bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/30',
            desc: 'Procurement cost breakdown, commitments and bulk savings',
            link: '/purchase-orders',
            filename: 'financial_summary_report',
        },
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
                        <div
                            onClick={openParcelChartModal}
                            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all duration-200 hover:border-pink-500/40 hover:shadow-md cursor-pointer group relative"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                    <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                        <i className="fas fa-box text-xs"></i>
                                    </div>
                                    <span>Parcel Volume Trend</span>
                                    <InfoTooltip text="Tracks parcel status changes over the last 7 days" />
                                </h3>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openParcelChartModal();
                                    }}
                                    className="text-[10px] font-semibold text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 flex items-center gap-1 transition-all duration-200 hover:gap-1.5"
                                >
                                    <span>View Details</span>
                                    <i className="fas fa-expand text-[8px]"></i>
                                </button>
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
                        <div
                            onClick={openInventoryChartModal}
                            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all duration-200 hover:border-amber-500/40 hover:shadow-md cursor-pointer group relative"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/30">
                                        <i className="fas fa-warehouse text-xs"></i>
                                    </div>
                                    <span>Inventory by Category</span>
                                    <InfoTooltip text="Distribution of inventory items across categories" />
                                </h3>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openInventoryChartModal();
                                    }}
                                    className="text-[10px] font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 flex items-center gap-1 transition-all duration-200 hover:gap-1.5"
                                >
                                    <span>View All</span>
                                    <i className="fas fa-expand text-[8px]"></i>
                                </button>
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
                                onClick={openKPIChartModal}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 text-center shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-500/40 hover:shadow-sm group relative cursor-pointer"
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
                    <div
                        onClick={openForecastChartModal}
                        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all duration-200 hover:border-pink-500/40 hover:shadow-md cursor-pointer group relative"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30">
                                    <i className="fas fa-chart-line text-xs"></i>
                                </div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                        <span>Volume Forecast</span>
                                        <InfoTooltip text="AI-powered 12-month volume projection with confidence intervals" />
                                    </h3>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 border border-pink-200/60 dark:border-pink-900/40">
                                        AI Powered
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openForecastChartModal();
                                }}
                                className="text-[10px] font-semibold text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 flex items-center gap-1 transition-all duration-200 hover:gap-1.5"
                            >
                                <span>View Forecast</span>
                                <i className="fas fa-expand text-[8px]"></i>
                            </button>
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

                        <div
                            onClick={openKPIChartModal}
                            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all duration-200 hover:border-pink-500/40 hover:shadow-md cursor-pointer group relative"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                    <div className="w-6 h-6 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                        <i className="fas fa-chart-bar text-xs"></i>
                                    </div>
                                    <span>KPI Performance Chart</span>
                                    <InfoTooltip text="Visual representation of all KPI values for quick comparison" />
                                </h3>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openKPIChartModal();
                                    }}
                                    className="text-[10px] font-semibold text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 flex items-center gap-1 transition-all duration-200 hover:gap-1.5"
                                >
                                    <span>View All KPIs</span>
                                    <i className="fas fa-expand text-[8px]"></i>
                                </button>
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
                                        <AppButton
                                            type="button"
                                            variant="neutral"
                                            size="icon-sm"
                                            onClick={() => setSelectedInsight(null)}
                                            aria-label="Close modal"
                                        >
                                            <i className="fas fa-times text-xs" />
                                        </AppButton>
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
                                                <Link href={selectedInsight.actionLink || '#'}>
                                                    <AppButton
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                    >
                                                        <span>{selectedInsight.actionText || 'Take Action'}</span>
                                                        <i className="fas fa-arrow-right text-[10px]" />
                                                    </AppButton>
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
                        <div
                            onClick={openForecastChartModal}
                            className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-all duration-200 hover:border-pink-500/40 hover:shadow-md cursor-pointer group relative"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400">
                                        <i className="fas fa-chart-line text-xs"></i>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                            Volume Forecast
                                        </h3>
                                        <InfoTooltip text="AI-powered 12-month volume projection with confidence intervals" />
                                        <span className="text-[10px] font-semibold bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/40 px-2 py-0.5 rounded-md">
                                            AI Powered
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openForecastChartModal();
                                    }}
                                    className="text-[10px] font-semibold text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 flex items-center gap-1 transition-all duration-200 hover:gap-1.5"
                                >
                                    <span>View full forecast</span>
                                    <i className="fas fa-expand text-[8px]"></i>
                                </button>
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
                            {reportsList.map((report) => (
                                <div
                                    key={report.id}
                                    onClick={() => openReportModal(report.id)}
                                    className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-500/40 dark:hover:border-pink-500/30 hover:shadow-md flex flex-col justify-between cursor-pointer"
                                >
                                    <div>
                                        <div className="flex items-start gap-3.5">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${report.bg} transition-transform duration-200 group-hover:scale-105`}>
                                                <i className={`fas ${report.icon} text-sm ${report.color}`}></i>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
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
                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                            <i className="fas fa-check-circle text-[9px] text-emerald-500"></i>
                                            <span>Export Ready</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openReportModal(report.id);
                                            }}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-all group/link cursor-pointer"
                                        >
                                            <i className="fas fa-file-pdf text-[10px] opacity-90"></i>
                                            <span>View Report</span>
                                            <i className="fas fa-arrow-right text-[8px] transition-transform duration-200 group-hover/link:translate-x-0.5"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabContent>
            )}
            
            {/* Reusable Executive Chart Detail Modal */}
            {activeChartModal && (
                <ExecutiveChartModal
                    isOpen={Boolean(activeChartModal)}
                    onClose={() => setActiveChartModal(null)}
                    {...activeChartModal}
                />
            )}
        </div>
    );
}