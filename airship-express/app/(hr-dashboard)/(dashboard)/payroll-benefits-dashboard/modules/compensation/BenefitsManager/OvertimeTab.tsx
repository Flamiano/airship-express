'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Loader2, Clock3, TrendingUp, Moon, CheckCircle2, RefreshCw,
    Printer, FileSpreadsheet, TimerOff,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { printTable, exportExcel, printFormatters, PrintColumn } from '../print-utils';
import { StatCard } from './shared';

const initialsOf = (name: string) =>
    (name || '??').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

const OvertimeTab = () => {
    const toast = useToast();
    const [employees, setEmployees] = useState<any[]>([]);
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const { fetchData: fetchEmployees } = useApi(
        '/payroll-benefits-dashboard/api/payroll/employee-info'
    );
    const { fetchData: fetchAttendance } = useApi(
        '/payroll-benefits-dashboard/api/payroll/attendance'
    );

    useEffect(() => { loadEmployeesAndCompute(); }, []);

    const loadEmployeesAndCompute = async () => {
        setLoading(true);
        try {
            const emps = await fetchEmployees().catch(() => []);
            const list = Array.isArray(emps) ? emps : [];
            setEmployees(list);
            await compute(list);
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to load overtime data');
        } finally { setLoading(false); }
    };

    const compute = async (list: any[]) => {
        const computed: any[] = [];
        for (const emp of list) {
            const logs = await fetchAttendance(`?employee_id=${emp.employee_id}`).catch(() => []);
            const attendance = Array.isArray(logs) ? logs : [];

            let totalHours = 0, otHours = 0, ndHours = 0;

            attendance.forEach((log: any) => {
                if (log.status !== 'On-Shift') return;
                const [sh, sm] = String(log.shift_start).split(':').map(Number);
                const [eh, em] = String(log.shift_end).split(':').map(Number);
                let start = sh * 60 + (sm || 0);
                let end = eh * 60 + (em || 0);
                if (end <= start) end += 1440;
                const hours = (end - start) / 60;
                totalHours += hours;

                const hoursPerDay = Number(emp.hours_per_day) || 8;
                const breakHours = Number(emp.break_hours) || 1;
                const dailyCap = hoursPerDay - breakHours;
                otHours += Math.max(0, hours - dailyCap);

                const ndStart = 22 * 60;
                const ndEnd = 4 * 60 + 1440;
                let a2 = end;
                if (a2 <= start) a2 += 1440;
                const overlapStart = Math.max(start, ndStart);
                const overlapEnd = Math.min(a2, ndEnd);
                if (overlapEnd > overlapStart) ndHours += (overlapEnd - overlapStart) / 60;
            });

            computed.push({
                employee_id: emp.employee_id,
                employee_name: emp.employee_name,
                employee_id_number: emp.employee_id_number,
                job_title: emp.job_title,
                total_hours: totalHours,
                overtime_hours: otHours,
                night_diff_hours: ndHours,
            });
        }
        setRows(computed);
    };

    const handleRefresh = async () => { await loadEmployeesAndCompute(); };

    const printColumns: PrintColumn[] = [
        { key: 'employee_name', label: 'Employee' },
        { key: 'employee_id_number', label: 'Employee ID' },
        { key: 'job_title', label: 'Position', format: (v) => printFormatters.text(v || '—') },
        { key: 'total_hours', label: 'Total Hours', align: 'right', format: (v) => Number(v || 0).toFixed(2) },
        { key: 'overtime_hours', label: 'OT Hours', align: 'right', format: (v) => Number(v || 0).toFixed(2) },
        { key: 'night_diff_hours', label: 'Night Diff Hours', align: 'right', format: (v) => Number(v || 0).toFixed(2) },
    ];

    const handlePrint = () => {
        if (rows.length === 0) { toast.showError('No overtime data to print.'); return; }
        printTable({
            companyName: 'Airship Express',
            companyAddress: 'Binondo, Manila, Philippines',
            reportTitle: 'Overtime & Night Differential Hours',
            reportSubtitle: 'Computed from attendance time in / out',
            filters: { 'Total Employees': rows.length },
            logoPath: '/images/logo-remove-bg.png',
        }, printColumns, rows);
    };

    const handleExport = () => {
        if (rows.length === 0) { toast.showError('No overtime data to export.'); return; }
        exportExcel(`overtime-${new Date().toISOString().split('T')[0]}`, printColumns, rows, {
            reportTitle: 'Overtime & Night Differential Hours',
            reportSubtitle: 'Computed from attendance time in / out',
        });
        toast.showSuccess('Overtime data exported to Excel.');
    };

    const totalOT = useMemo(() => rows.reduce((s, r) => s + (r.overtime_hours || 0), 0), [rows]);
    const totalND = useMemo(() => rows.reduce((s, r) => s + (r.night_diff_hours || 0), 0), [rows]);
    const maxOT = useMemo(() => Math.max(1, ...rows.map((r) => r.overtime_hours || 0)), [rows]);
    const maxND = useMemo(() => Math.max(1, ...rows.map((r) => r.night_diff_hours || 0)), [rows]);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Clock3} label="Employees" value={String(rows.length)} tint="blue" />
                <StatCard icon={TrendingUp} label="Total OT Hours" value={totalOT.toFixed(2)} tint="amber" />
                <StatCard icon={Moon} label="Total Night Hours" value={totalND.toFixed(2)} tint="purple" />
                <StatCard icon={CheckCircle2} label="Based On" value="Attendance" tint="emerald" />
            </div>

            <div className="flex flex-wrap gap-2 justify-stretch sm:justify-end w-full">
                <Button onClick={handleRefresh} disabled={loading} className="font-rethink text-xs h-9 px-3 rounded-md bg-slate-600 text-white hover:bg-slate-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-60">
                    <span className="flex flex-row items-center justify-center gap-1.5">
                        <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} />
                        <span className="whitespace-nowrap leading-none">Refresh</span>
                    </span>
                </Button>
                <Button onClick={handlePrint} className="font-rethink text-xs h-9 px-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                    <span className="flex flex-row items-center justify-center gap-1.5">
                        <Printer className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-nowrap leading-none">Print</span>
                    </span>
                </Button>
                <Button onClick={handleExport} className="font-rethink text-xs h-9 px-3 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                    <span className="flex flex-row items-center justify-center gap-1.5">
                        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-nowrap leading-none">Export</span>
                    </span>
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading overtime data…
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30 mb-3">
                            <TimerOff className="h-6 w-6 text-amber-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No attendance records yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Overtime and night differential hours are computed from clock in / clock out data.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden md:table-cell">Position</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Total Hours</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">OT Hours</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Night Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {rows.map((row) => {
                                        const otPct = (row.overtime_hours / maxOT) * 100;
                                        const ndPct = (row.night_diff_hours / maxND) * 100;
                                        return (
                                            <motion.tr
                                                key={row.employee_id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/10"
                                            >
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-[11px] font-semibold text-blue-700 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300">
                                                            {initialsOf(row.employee_name)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[13px] font-medium text-ink font-rethink truncate">{row.employee_name}</p>
                                                            <p className="text-[10px] text-muted font-rethink">{row.employee_id_number}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-[12px] text-ink/70 font-rethink hidden md:table-cell">
                                                    {row.job_title || '—'}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="inline-flex items-center rounded-md bg-ink/[0.04] px-2 py-1 font-mono text-[12px] font-semibold text-ink dark:bg-ink/[0.08]">
                                                        {row.total_hours.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 font-mono text-[12px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40">
                                                            {row.overtime_hours.toFixed(2)}
                                                        </span>
                                                        <div className="h-1 w-16 rounded-full bg-amber-100 dark:bg-amber-950/40 overflow-hidden">
                                                            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${otPct}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 font-mono text-[12px] font-semibold text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:ring-purple-800/40">
                                                            {row.night_diff_hours.toFixed(2)}
                                                        </span>
                                                        <div className="h-1 w-16 rounded-full bg-purple-100 dark:bg-purple-950/40 overflow-hidden">
                                                            <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${ndPct}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default OvertimeTab;