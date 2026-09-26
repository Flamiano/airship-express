'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Loader2, PieChart } from 'lucide-react';
import Chart from 'chart.js/auto';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import type { EmployeePayrollInfoRow } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/types';

function cssVar(name: string, fallback: string) {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

type Employee = EmployeePayrollInfoRow;

export function ChartsRow() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const empChartRef = useRef<HTMLCanvasElement | null>(null);
    const posChartRef = useRef<HTMLCanvasElement | null>(null);
    const empInstance = useRef<Chart | null>(null);
    const posInstance = useRef<Chart | null>(null);

    const { fetchData: fetchEmployees } = useApi(
        '/payroll-benefits-dashboard/api/payroll/employee-info'
    );
    const { fetchData: fetchPositions } = useApi(
        '/payroll-benefits-dashboard/api/payroll/job-settings'
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [emp, pos] = await Promise.all([
                    fetchEmployees().catch(() => []),
                    fetchPositions().catch(() => []),
                ]);
                if (cancelled) return;
                setEmployees(Array.isArray(emp) ? emp : emp?.rows ?? []);
                setPositions(Array.isArray(pos) ? pos : pos?.rows ?? []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [fetchEmployees, fetchPositions]);

    const empByDept = useMemo(() => {
        const map: Record<string, number> = {};
        employees.forEach((e) => {
            const d = e.department || 'Unassigned';
            map[d] = (map[d] || 0) + 1;
        });
        return map;
    }, [employees]);

    const posByDept = useMemo(() => {
        const map: Record<string, number> = {};
        positions.forEach((p: any) => {
            const d = p.department || 'Unassigned';
            map[d] = (map[d] || 0) + 1;
        });
        return map;
    }, [positions]);

    const empLabels = useMemo(() => Object.keys(empByDept), [empByDept]);
    const empValues = useMemo(() => empLabels.map((l) => empByDept[l]), [empLabels, empByDept]);
    const posLabels = useMemo(() => Object.keys(posByDept), [posByDept]);
    const posValues = useMemo(() => posLabels.map((l) => posByDept[l]), [posLabels, posByDept]);

    useEffect(() => {
        if (loading || !empChartRef.current || empLabels.length === 0) return;
        empInstance.current?.destroy();

        const palette = [
            cssVar('--accent', '#e5167e'),
            '#2455c7',
            '#0b8f6b',
            '#b8720e',
            '#8b5cf6',
            '#f59e0b',
            '#06b6d4',
            '#ef4444',
        ];

        empInstance.current = new Chart(empChartRef.current, {
            type: 'doughnut',
            data: {
                labels: empLabels,
                datasets: [
                    {
                        data: empValues,
                        backgroundColor: empLabels.map((_, i) => palette[i % palette.length]),
                        borderWidth: 2,
                        borderColor: cssVar('--paper', '#fff'),
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                animation: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 8,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 11 },
                            color: cssVar('--ink', '#1c1b1f'),
                        },
                    },
                },
            },
        });
        return () => {
            empInstance.current?.destroy();
        };
    }, [empLabels, empValues, loading]);

    useEffect(() => {
        if (loading || !posChartRef.current || posLabels.length === 0) return;
        posInstance.current?.destroy();

        posInstance.current = new Chart(posChartRef.current, {
            type: 'bar',
            data: {
                labels: posLabels,
                datasets: [
                    {
                        label: 'Positions',
                        data: posValues,
                        backgroundColor: cssVar('--accent', '#e5167e'),
                        borderRadius: 6,
                        barThickness: 18,
                    },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            color: cssVar('--muted', '#6b6b76'),
                            font: { size: 10 },
                            precision: 0,
                        },
                        grid: { color: cssVar('--line', '#eaeaea') },
                    },
                    y: {
                        ticks: { color: cssVar('--ink', '#1c1b1f'), font: { size: 11 } },
                        grid: { display: false },
                    },
                },
            },
        });
        return () => {
            posInstance.current?.destroy();
        };
    }, [posLabels, posValues, loading]);

    return (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <div className="relative overflow-hidden rounded-2xl border border-line border-l-4 border-l-accent bg-paper p-4 lg:col-span-3 dark:border-paper/10">
                <PieChart
                    size={72}
                    className="pointer-events-none absolute -bottom-3 -right-3 text-accent opacity-[0.06]"
                />
                <div className="relative flex items-center gap-1.5 mb-3">
                    <PieChart className="h-3.5 w-3.5 text-accent" />
                    <p className="text-[12px] font-semibold text-ink font-rethink">
                        Employees by department
                    </p>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-[12px] text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                ) : empLabels.length === 0 ? (
                    <p className="py-16 text-center text-[12px] text-muted">No employee data yet.</p>
                ) : (
                    <div className="h-56">
                        <canvas ref={empChartRef} />
                    </div>
                )}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-line border-l-4 border-l-emerald-500 bg-paper p-4 lg:col-span-2 dark:border-paper/10">
                <BarChart3
                    size={72}
                    className="pointer-events-none absolute -bottom-3 -right-3 text-emerald-500 opacity-[0.06]"
                />
                <div className="relative flex items-center gap-1.5 mb-3">
                    <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
                    <p className="text-[12px] font-semibold text-ink font-rethink">
                        Positions per department
                    </p>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-[12px] text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                ) : posLabels.length === 0 ? (
                    <p className="py-16 text-center text-[12px] text-muted">No positions yet.</p>
                ) : (
                    <div style={{ height: Math.min(posLabels.length, 6) * 38 + 20 }}>
                        <canvas ref={posChartRef} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChartsRow;