"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Chart from "chart.js/auto";
import Cards from '@/app/(supplyChain)/components/global/Cards';
import { LinkBtn } from '@/app/(supplyChain)/components/global/Buttons';
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { PageSkeleton } from "@/app/(supplyChain)/components/ui/SkeletonLoader";
import AiQuestions from "@/app/(supplyChain)/components/global/AiQuestions";
import { useAI } from "@/app/(supplyChain)/ai/services/AIContext";

interface DashboardStats {
    scannedParcels: number;
    highestParcels: number;
    monthlyTotal: number;
    topCourier: string;
    courierData: {
        name: string;
        data: number[];
        color: string;
    }[];
    dailyLabels: string[];
    dailyFullDates: string[];
    forecast: {
        day: string;
        parcels: number;
        change: number;
        width: number;
    }[];
}

interface ChartDataset {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
    tension: number;
    pointRadius: number;
    pointBackgroundColor: string;
    pointHoverRadius: number;
    pointHoverBackgroundColor: string;
}

export default function DashboardPanel() {
    const { openChat } = useAI();
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);
    const [stats, setStats] = useState<DashboardStats>({
        scannedParcels: 0,
        highestParcels: 0,
        monthlyTotal: 0,
        topCourier: 'N/A',
        courierData: [],
        dailyLabels: [],
        dailyFullDates: [],
        forecast: [],
    });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isMobile, setIsMobile] = useState(false);
    const [courierDetails, setCourierDetails] = useState<{
        topCourier: { name: string; count: number };
        courierBreakdown: { name: string; count: number }[];
        peakHour: { hour: number; count: number; timeRange: string };
        busiestDay: { date: string; count: number; dayName: string };
        avgDaily: number;
    }>({
        topCourier: { name: 'N/A', count: 0 },
        courierBreakdown: [],
        peakHour: { hour: 0, count: 0, timeRange: '' },
        busiestDay: { date: '', count: 0, dayName: '' },
        avgDaily: 0,
    });

    const isMounted = useRef(true);
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = (message: string, type: string = "info") => {
        alert(message);
    };

    const colors = ['#818CF8', '#F472B6', '#FBBF24', '#34D399', '#A78BFA', '#FB7185', '#60A5FA', '#FCD34D'];

    // Check if mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);

            const today = new Date();
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            //  1. Get total scanned today
            const { count: scannedCount, error: scannedError } = await supabase
                .from('parcels')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString());

            if (scannedError) throw scannedError;

            //  2. Get detailed hourly data for peak hour
            const { data: hourlyData, error: hourlyError } = await supabase
                .from('parcels')
                .select('created_at')
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString());

            if (hourlyError) throw hourlyError;

            let highestParcels = 0;
            let peakHour = 0;
            if (hourlyData && hourlyData.length > 0) {
                const hourCounts: Record<string, number> = {};
                hourlyData.forEach((p: any) => {
                    const hour = new Date(p.created_at).getHours();
                    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                });

                let maxCount = 0;
                let maxHour = 0;
                for (const [hour, count] of Object.entries(hourCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        maxHour = parseInt(hour);
                    }
                }
                highestParcels = maxCount;
                peakHour = maxHour;
            }

            //  3. Get monthly total - FIX: handle null
            const { count: monthlyCount, error: monthlyError } = await supabase
                .from('parcels')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (monthlyError) throw monthlyError;

            //  4. Get top courier with count
            const { data: courierStats, error: courierStatsError } = await supabase
                .from('parcels')
                .select('courier')
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString());

            if (courierStatsError) throw courierStatsError;

            let topCourier = 'N/A';
            let topCourierCount = 0;
            const courierCounts: Record<string, number> = {};

            if (courierStats && courierStats.length > 0) {
                courierStats.forEach((p: any) => {
                    if (p.courier) {
                        courierCounts[p.courier] = (courierCounts[p.courier] || 0) + 1;
                    }
                });

                let maxCount = 0;
                let maxName = '';
                for (const [name, count] of Object.entries(courierCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        maxName = name;
                    }
                }
                topCourier = maxName || 'N/A';
                topCourierCount = maxCount;
            }

            //  5. Get courier breakdown for all couriers
            const courierBreakdown = Object.entries(courierCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            //  6. Get busiest day in the last 7 days
            const { data: dailyData, error: dailyError } = await supabase
                .from('parcels')
                .select('created_at')
                .gte('created_at', sevenDaysAgo.toISOString());

            if (dailyError) throw dailyError;

            const dailyCountMap: Record<string, number> = {};
            dailyData?.forEach((p: any) => {
                const date = new Date(p.created_at).toISOString().split('T')[0];
                dailyCountMap[date] = (dailyCountMap[date] || 0) + 1;
            });

            let busiestDate = '';
            let busiestCount = 0;
            for (const [date, count] of Object.entries(dailyCountMap)) {
                if (count > busiestCount) {
                    busiestCount = count;
                    busiestDate = date;
                }
            }

            const busiestDayName = busiestDate
                ? new Date(busiestDate).toLocaleDateString('en-US', { weekday: 'long' })
                : 'N/A';

            //  7. Calculate average daily - FIX: handle null monthlyCount
            const safeMonthlyCount = monthlyCount || 0;
            const avgDaily = safeMonthlyCount > 0 ? Math.round(safeMonthlyCount / 30) : 0;

            //  8. Set courier details
            setCourierDetails({
                topCourier: { name: topCourier, count: topCourierCount },
                courierBreakdown,
                peakHour: {
                    hour: peakHour,
                    count: highestParcels,
                    timeRange: peakHour > 0 ? `${peakHour}:00 - ${peakHour + 1}:00` : 'No data'
                },
                busiestDay: {
                    date: busiestDate,
                    count: busiestCount,
                    dayName: busiestDayName
                },
                avgDaily,
            });

            //  9. Get courier data for chart (last 7 days)
            const { data: courierChartData, error: courierChartError } = await supabase
                .from('parcels')
                .select('courier, created_at')
                .gte('created_at', sevenDaysAgo.toISOString());

            if (courierChartError) throw courierChartError;

            //  Generate proper date labels for the last 7 days
            const dateLabels: string[] = [];
            const fullDateLabels: string[] = [];
            const dateMap: Record<string, number> = {};

            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateKey = date.toISOString().split('T')[0];
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                dateLabels.push(dayName);
                fullDateLabels.push(`${dayName}, ${monthDay}`);
                dateMap[dateKey] = 6 - i;
            }

            //  Initialize courier data with zeros for all 7 days
            const courierMap: Record<string, number[]> = {};

            if (courierChartData) {
                courierChartData.forEach((p: any) => {
                    const date = new Date(p.created_at);
                    const dateKey = date.toISOString().split('T')[0];
                    const dayIndex = dateMap[dateKey];

                    if (dayIndex !== undefined && p.courier) {
                        if (!courierMap[p.courier]) {
                            courierMap[p.courier] = new Array(7).fill(0);
                        }
                        courierMap[p.courier][dayIndex] += 1;
                    }
                });
            }

            const courierData = Object.keys(courierMap).map((name, index) => ({
                name,
                data: courierMap[name],
                color: colors[index % colors.length],
            }));

            //  10. Generate forecast
            const dailyValues = Object.values(dailyCountMap);
            const avg = dailyValues.length > 0
                ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
                : 100;

            const forecastDays = ['Tomorrow', 'In 2 days', 'In 3 days', 'In 5 days', 'In 7 days'];
            const forecastChanges = [8, -3, 12, -5, 6];
            const maxParcels = 2000;

            const forecast = forecastDays.map((day, index) => {
                const parcels = Math.round(avg * (1 + forecastChanges[index] / 100));
                const width = Math.min(Math.max((parcels / maxParcels) * 100, 5), 100);
                return {
                    day,
                    parcels,
                    change: forecastChanges[index],
                    width,
                };
            });

            if (isMounted.current) {
                setStats({
                    scannedParcels: scannedCount || 0,
                    highestParcels: highestParcels || 0,
                    monthlyTotal: safeMonthlyCount,
                    topCourier: topCourier || 'N/A',
                    courierData,
                    dailyLabels: dateLabels,
                    dailyFullDates: fullDateLabels,
                    forecast,
                });

                setLastUpdated(new Date());
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initialize chart based on screen size
    useEffect(() => {
        if (loading || !chartRef.current) return;

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
            chartInstanceRef.current = null;
        }

        const ctx = chartRef.current.getContext("2d");
        if (!ctx) return;

        // Mobile: Pie Chart - Enhanced
        if (isMobile) {
            const courierTotals: Record<string, number> = {};
            stats.courierData.forEach((courier) => {
                const total = courier.data.reduce((sum, val) => sum + val, 0);
                courierTotals[courier.name] = total;
            });

            const labels = Object.keys(courierTotals);
            const data = Object.values(courierTotals);
            const backgroundColors = labels.map((_, index) => colors[index % colors.length]);

            chartInstanceRef.current = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: labels.length > 0 ? labels : ['No Data'],
                    datasets: [{
                        data: data.length > 0 ? data : [1],
                        backgroundColor: backgroundColors.length > 0 ? backgroundColors : ['#818CF8'],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        hoverOffset: 10,
                        hoverBorderWidth: 2,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '50%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 14,
                                boxHeight: 14,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: 12,
                                font: {
                                    size: 11,
                                    weight: 500 as const,
                                    family: "'Inter', system-ui, sans-serif"
                                },
                                color: '#475569',
                            },
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            titleColor: '#0f172a',
                            bodyColor: '#475569',
                            borderColor: '#e2e8f0',
                            borderWidth: 1,
                            cornerRadius: 12,
                            padding: 14,
                            callbacks: {
                                label: function (context) {
                                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                    const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                    const label = context.label || '';
                                    return `${label}: ${context.parsed} parcels (${percentage}%)`;
                                }
                            }
                        }
                    },
                    animation: {
                        animateRotate: true,
                        duration: 800,
                        easing: 'easeInOutQuart',
                    },
                },
            });
        }
        // Desktop: Line Chart - Enhanced
        else {
            const datasets: ChartDataset[] = stats.courierData.map((courier, index) => ({
                label: courier.name,
                data: courier.data,
                borderColor: courier.color,
                backgroundColor: `${courier.color}10`,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: courier.color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: courier.color,
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3,
                borderWidth: 2.5,
            }));

            chartInstanceRef.current = new Chart(ctx, {
                type: "line",
                data: {
                    labels: stats.dailyFullDates,
                    datasets,
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: "top",
                            align: "start",
                            labels: {
                                boxWidth: 12,
                                boxHeight: 12,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                font: {
                                    size: 11,
                                    weight: 500 as const,
                                    family: "'Inter', system-ui, sans-serif"
                                },
                                padding: 15,
                                color: '#64748b',
                            },
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            titleColor: '#0f172a',
                            bodyColor: '#475569',
                            borderColor: '#e2e8f0',
                            borderWidth: 1,
                            cornerRadius: 12,
                            boxPadding: 8,
                            usePointStyle: true,
                            padding: 14,
                            callbacks: {
                                title: (items) => {
                                    return items[0].label;
                                },
                                label: (context) => {
                                    const label = context.dataset.label || '';
                                    const value = context.parsed.y || 0;
                                    return `${label}: ${value} parcels`;
                                },
                                afterBody: (items) => {
                                    const total = items.reduce((sum, i) => sum + (i.parsed.y || 0), 0);
                                    return `📦 Total: ${total} parcels`;
                                },
                            },
                        },
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false,
                            },
                            ticks: {
                                font: {
                                    size: 10,
                                    weight: 500 as const,
                                },
                                color: '#94a3b8',
                            },
                            border: {
                                display: false,
                            },
                        },
                        y: {
                            grid: {
                                color: "#f1f5f9",
                            },
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                font: {
                                    size: 10,
                                    weight: 500 as const,
                                },
                                color: '#94a3b8',
                                padding: 8,
                            },
                            border: {
                                display: false,
                            },
                        },
                    },
                    hover: {
                        mode: 'nearest',
                        intersect: true,
                    },
                    elements: {
                        line: {
                            tension: 0.4,
                        },
                    },
                    animation: {
                        duration: 750,
                        easing: 'easeInOutQuart',
                    },
                },
            });
        }
    }, [loading, stats.courierData, stats.dailyFullDates, isMobile]);

    // Real-time subscription
    useEffect(() => {
        isMounted.current = true;
        console.log('Setting up dashboard real-time subscription...');

        fetchDashboardData();

        const subscription = supabase
            .channel('dashboard_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'parcels' },
                async (payload) => {
                    if (isMounted.current) {
                        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
                        refreshTimeoutRef.current = setTimeout(() => fetchDashboardData(), 500);
                    }
                }
            )
            .subscribe((status) => console.log('Dashboard subscription status:', status));

        return () => {
            console.log('Cleaning up dashboard real-time subscription...');
            subscription.unsubscribe();
            if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
            isMounted.current = false;
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [fetchDashboardData]);

    if (loading) {
        return <PageSkeleton />;
    }

    return (
        <div data-panel="dashboard" className="p-4 sm:p-8 space-y-6 sm:space-y-8 mx-auto ">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300 text-[11px] font-semibold border border-slate-200/60 dark:border-slate-700/60">
                            <i className="fas fa-warehouse text-slate-400 dark:text-slate-400 text-[10px]" />
                            <span>Airship Express</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-slate-500 dark:text-slate-400">Warehouse</span>
                        </div>
                    </div>

                    <div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Dashboard
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Real-time warehouse operations overview and metrics
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-400 font-medium">
                        <i className="fas fa-clock text-[11px] text-slate-400 dark:text-slate-500" />
                        <span>
                            Updated:{" "}
                            <strong className="text-slate-600 dark:text-slate-300 font-semibold">
                                {lastUpdated.toLocaleTimeString()}
                            </strong>
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={fetchDashboardData}
                        title="Refresh dashboard metrics"
                        className="p-2 sm:px-4 sm:py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-slate-800/60 dark:hover:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center gap-2 active:scale-95 cursor-pointer group"
                    >
                        <i className="fas fa-rotate text-xs text-slate-500 dark:text-slate-400 transition-transform group-hover:rotate-180 duration-500" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <Cards
                    frontIcon="fas fa-box mr-1"
                    header="Received Parcels"
                    data={stats.scannedParcels.toLocaleString()}
                    arrow="fas fa-arrow-up mr-1"
                    description="Today"
                    backBg="bg-slate-900"
                    backHeader="Received Parcels Details"
                    backIcon="fas fa-box"
                    headerTextColor="text-slate-200"
                    backDescription={`Total of ${stats.scannedParcels} parcels received today.\n\n ${courierDetails.courierBreakdown.length > 0 ? courierDetails.courierBreakdown.slice(0, 3).map(c => `${c.name}: ${c.count}`).join('\n') : 'No courier data'}\n\n Top Courier: ${courierDetails.topCourier.name} (${courierDetails.topCourier.count} parcels)`}
                    tooltip="Click to see details about received parcels"
                    tooltipLink="/warehousing?tab=incoming"
                    badge={stats.scannedParcels > 0 ? 'Live' : ''}
                />

                <Cards
                    frontIcon="fas fa-clock mr-1"
                    header="Peak Hour Volume"
                    data={stats.highestParcels.toString()}
                    arrow="fas fa-arrow-up mr-1"
                    description={courierDetails.peakHour.timeRange}
                    backBg="bg-slate-900"
                    backHeader="Peak Hour Details"
                    backIcon="fas fa-clock"
                    headerTextColor="text-slate-200"
                    backDescription={`${stats.highestParcels} parcels during peak hour.\n\n⏰ Time: ${courierDetails.peakHour.timeRange}\n\n Avg parcels/hour: ${Math.round(stats.scannedParcels / Math.max(1, Object.keys(courierDetails.courierBreakdown).length || 1))}`}
                    tooltip="Click to see peak hour details"
                    tooltipLink="/warehousing?tab=incoming&view=hourly"
                    badge={courierDetails.peakHour.timeRange !== 'No data' ? `Peak ${courierDetails.peakHour.timeRange}` : ''}
                />

                <Cards
                    frontIcon="fas fa-warehouse mr-1"
                    header="Total Parcels (30D)"
                    data={stats.monthlyTotal.toLocaleString()}
                    arrow="fas fa-arrow-up mr-1"
                    description="Last 30 days"
                    backBg="bg-slate-900"
                    backHeader="Monthly Parcel Details"
                    backIcon="fas fa-chart-line"
                    headerTextColor="text-slate-200"
                    backDescription={`Total of ${stats.monthlyTotal} parcels processed.\n\n📈 Daily average: ${courierDetails.avgDaily} parcels/day\n\n Busiest day: ${courierDetails.busiestDay.dayName} (${courierDetails.busiestDay.count} parcels)`}
                    tooltip="Click to see monthly statistics"
                    tooltipLink="/inventory"
                    badge={`${courierDetails.avgDaily}/day avg`}
                />

                <Cards
                    frontIcon="fas fa-calendar-day mr-1"
                    header="Busiest Day"
                    data={courierDetails.busiestDay.dayName || 'N/A'}
                    arrow="fas fa-arrow-up mr-1"
                    description={`${courierDetails.busiestDay.count} parcels`}
                    backBg="bg-slate-900"
                    backHeader="Busiest Day Details"
                    backIcon="fas fa-calendar-check"
                    headerTextColor="text-slate-200"
                    backDescription={`Busiest day: ${courierDetails.busiestDay.dayName}\n\n📦 Parcels: ${courierDetails.busiestDay.count}\n\n Date: ${courierDetails.busiestDay.date ? new Date(courierDetails.busiestDay.date).toLocaleDateString() : 'N/A'}\n\n Top courier: ${courierDetails.topCourier.name} (${courierDetails.topCourier.count} parcels)`}
                    tooltip="Click to see busiest day details"
                    tooltipLink="/warehousing?tab=incoming&view=daily"
                    badge={`${courierDetails.busiestDay.count} parcels`}
                />
            </div>

            {/* Chart - Mobile: Doughnut, Desktop: Line */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-2xl dark:shadow-black/40 flex flex-col justify-between transition-all hover:shadow-md dark:hover:shadow-2xl">
                <div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-500 dark:to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 dark:shadow-indigo-500/30">
                                <i className={`fas ${isMobile ? 'fa-chart-pie' : 'fa-chart-line'} text-sm`} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-800 dark:text-white text-sm sm:text-base">
                                    {isMobile ? 'Courier Distribution' : 'Courier Parcel Volume'}
                                </h2>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                    {isMobile ? 'Total parcels by courier' : 'Daily volume over 7 days'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                                {isMobile ? 'Distribution' : '7 Days'}
                            </span>
                            {!isMobile && stats.courierData.length > 0 && (
                                <span className="text-[10px] font-medium px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-200/60 dark:border-indigo-900/40">
                                    <i className="fas fa-rotate-right text-[9px] mr-1 animate-spin-slow" />
                                    Live
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 relative min-h-[250px] sm:min-h-[200px]">
                        <canvas ref={chartRef}></canvas>
                    </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <i className="fas fa-circle-info text-[10px]"></i>
                        <span>{isMobile ? 'Pie chart shows total parcels per courier' : 'Hover over data points to inspect specific metrics'}</span>
                    </div>
                    {!isMobile && stats.courierData.length > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-1">
                                {stats.courierData.slice(0, 3).map((courier, idx) => (
                                    <div
                                        key={idx}
                                        className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
                                        style={{ backgroundColor: courier.color }}
                                        title={courier.name}
                                    >
                                        {courier.name.charAt(0)}
                                    </div>
                                ))}
                                {stats.courierData.length > 3 && (
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-300 shadow-sm">
                                        +{stats.courierData.length - 3}
                                    </div>
                                )}
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {stats.courierData.length} couriers
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* AI and Forecast */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-2xl dark:shadow-black/40 flex flex-col justify-between transition-all hover:shadow-md dark:hover:shadow-2xl">
                    <div>
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-pink-500/20">
                                <i className="fas fa-robot text-sm" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-800 dark:text-white text-sm sm:text-base">
                                    Ask AI Assistant
                                </h2>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                    Suggested queries
                                </p>
                            </div>
                        </div>
                        <AiQuestions
                            title=""
                            subtitle=""
                            questions={[
                                {
                                    question: `How many parcels were received today? (${stats.scannedParcels})`,
                                    color: "bg-pink-500"
                                },
                                {
                                    question: `What's the expected dispatch volume for tomorrow? (${stats.forecast[0]?.parcels || 0})`,
                                    color: "bg-amber-500"
                                },
                                {
                                    question: `Which courier has the highest volume? (${courierDetails.topCourier.name}: ${courierDetails.topCourier.count})`,
                                    color: "bg-blue-500"
                                },
                                {
                                    question: `When was the busiest day this week? (${courierDetails.busiestDay.dayName}: ${courierDetails.busiestDay.count})`,
                                    color: "bg-emerald-500"
                                }
                            ]}
                            className="mt-4"
                            gridCols="grid-cols-1"
                        />
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                        <button
                            type="button"
                            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-pink-600 dark:text-pink-400 bg-pink-50/70 dark:bg-pink-950/30 hover:bg-pink-100/80 dark:hover:bg-pink-900/40 border border-pink-200/60 dark:border-pink-900/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer group"
                            onClick={() => openChat()}
                        >
                            <i className="fas fa-comment-dots text-[11px] group-hover:scale-110 transition-transform" />
                            <span>Open Interactive AI Chat →</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-2xl dark:shadow-black/40 flex flex-col justify-between transition-all hover:shadow-md dark:hover:shadow-2xl">
                    <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <i className="fas fa-chart-line text-sm" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-slate-800 dark:text-white text-sm sm:text-base">
                                        Gemini Forecast
                                    </h2>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                        7-Day Projection
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-semibold px-2.5 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 text-indigo-700 dark:text-indigo-400 rounded-full border border-indigo-200/60 dark:border-indigo-900/40">
                                AI Powered
                            </span>
                        </div>

                        <div className="mt-4 space-y-3">
                            {stats.forecast.length > 0 ? (
                                stats.forecast.map((item, index) => {
                                    const isPositive = item.change > 0;
                                    return (
                                        <div
                                            key={index}
                                            className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                                        >
                                            <div className="flex items-center justify-between text-xs sm:text-sm">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300 w-20">
                                                    {item.day}
                                                </span>
                                                <span className="font-semibold text-slate-900 dark:text-white">
                                                    {item.parcels.toLocaleString()}{" "}
                                                    <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                                                        parcels
                                                    </span>
                                                </span>
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${isPositive
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40"
                                                        : "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40"
                                                        }`}
                                                >
                                                    <i
                                                        className={`fas text-[10px] ${isPositive ? "fa-arrow-trend-up" : "fa-arrow-trend-down"
                                                            }`}
                                                    />
                                                    <span>{Math.abs(item.change)}%</span>
                                                </span>
                                            </div>

                                            <div className="mt-2.5 w-full bg-slate-200/70 dark:bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-500"
                                                    style={{ width: `${item.width}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center text-slate-400 dark:text-slate-500 py-8 flex flex-col items-center justify-center">
                                    <i className="fas fa-chart-line text-3xl mb-2 text-slate-300 dark:text-slate-600" />
                                    <p className="text-xs font-medium">No forecast data currently available</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <LinkBtn
                            link="/forecast"
                            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-900/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer group"
                            icon="fas fa-arrow-trend-up"
                            label="View Full Predictive Analytics →"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}