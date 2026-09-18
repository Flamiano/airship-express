'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Users, Search, Loader2, Eye, CheckCircle2, XCircle,
    DollarSign, TrendingUp, Gift, Coins,
    ChevronDown, ChevronRight, Wallet2
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { Search as SearchInput } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { EmployeeCompensationSummary } from '../../types';

const PAGE_SIZE = 8;

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({ icon: Icon, label, value, subtitle, tint }: {
    icon: React.ElementType;
    label: string;
    value: string;
    subtitle?: string;
    tint: 'accent' | 'emerald' | 'blue' | 'amber' | 'purple' | 'gray';
}) {
    const tints: Record<string, string> = {
        accent: 'bg-accent/10 text-accent',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
    };
    return (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tints[tint]}`}>
                <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">{label}</p>
                <p className="text-sm font-semibold font-mono tabular-nums text-ink truncate">{value}</p>
                {subtitle && <p className="text-[10px] text-muted font-rethink">{subtitle}</p>}
            </div>
        </div>
    );
}

const EmployeeCompensationManager = () => {
    const toast = useToast();
    const [employees, setEmployees] = useState<EmployeeCompensationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selected, setSelected] = useState<EmployeeCompensationSummary | null>(null);
    const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

    const { fetchData } = useApi('/payroll-benefits-dashboard/api/compensation/employee-compensation');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setEmployees(data || []);
        } catch (error: any) {
            console.error('Load error:', error);
            toast.showError(error?.message || 'Failed to load employee compensation');
        } finally {
            setLoading(false);
        }
    };

    const toggleEmployeeExpand = (employeeId: string) => {
        if (expandedEmployee === employeeId) {
            setExpandedEmployee(null);
        } else {
            setExpandedEmployee(employeeId);
        }
    };

    const filteredEmployees = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return employees;
        return employees.filter((e) =>
            e.employee_name?.toLowerCase().includes(term) ||
            e.employee_id_number?.toLowerCase().includes(term) ||
            (e.job_title || '').toLowerCase().includes(term)
        );
    }, [employees, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
    const paginatedEmployees = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredEmployees.slice(start, start + PAGE_SIZE);
    }, [filteredEmployees, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);
    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const totalMonthlyPayroll = useMemo(
        () => employees.reduce((sum, e) => sum + (e.effective_daily_rate || 0) * 24, 0),
        [employees]
    );
    const totalMonthlyCompensation = useMemo(
        () => employees.reduce((sum, e) => sum + (e.total_monthly_compensation || 0), 0),
        [employees]
    );
    const avgSalary = useMemo(
        () => employees.length > 0 ? totalMonthlyPayroll / employees.length : 0,
        [employees, totalMonthlyPayroll]
    );
    const customRateCount = useMemo(
        () => employees.filter((e) => e.is_custom_rate).length,
        [employees]
    );

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Users} label="Total Employees" value={String(employees.length)} tint="blue" />
                <StatCard icon={DollarSign} label="Monthly Payroll" value={peso(totalMonthlyPayroll)} tint="emerald" />
                <StatCard icon={TrendingUp} label="Avg Monthly Salary" value={peso(avgSalary)} tint="purple" />
                <StatCard icon={Wallet2} label="Custom Rates" value={String(customRateCount)} tint="amber" />
            </div>

            <div className="flex flex-col gap-3">
                <SearchInput
                    placeholder="Search by employee name, ID, or job title..."
                    onSearch={setSearchTerm}
                    className="w-full"
                />
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading employee compensation…
                    </div>
                ) : employees.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No employees found. Add employees first." />
                    </CardBody>
                ) : filteredEmployees.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No employees match your search." />
                    </CardBody>
                ) : (
                    <>
                        <div className="divide-y divide-line">
                            <AnimatePresence initial={false}>
                                {paginatedEmployees.map((employee) => {
                                    const isExpanded = expandedEmployee === employee.employee_id;

                                    return (
                                        <motion.div
                                            key={employee.employee_id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="p-4 hover:bg-ink/[0.015] transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => toggleEmployeeExpand(employee.employee_id)}
                                                            className="text-muted hover:text-ink transition-colors"
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                                                            <span className="text-xs font-semibold font-mono">
                                                                {employee.employee_name?.charAt(0) || '?'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-medium text-ink font-rethink">
                                                                    {employee.employee_name}
                                                                </p>
                                                                {employee.is_custom_rate && (
                                                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-medium text-amber-600 dark:border-amber-800/30 dark:bg-amber-950/30 dark:text-amber-400">
                                                                        <Coins className="h-2.5 w-2.5" />
                                                                        Custom
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-muted font-rethink">
                                                                {employee.employee_id_number} · {employee.job_title || 'No title'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-rethink">
                                                        <span className="text-muted">
                                                            Effective Daily: <span className="font-mono text-ink font-semibold">{peso(employee.effective_daily_rate)}</span>
                                                        </span>
                                                        <span className="text-muted">
                                                            Position Default: <span className="font-mono text-ink/70">{peso(employee.position_default_daily_rate)}</span>
                                                        </span>
                                                        {employee.is_custom_rate && employee.salary_adjustment_reason && (
                                                            <span className="text-muted truncate max-w-[200px]">
                                                                Reason: <span className="text-amber-600">{employee.salary_adjustment_reason}</span>
                                                            </span>
                                                        )}
                                                        <span className="text-muted">
                                                            Monthly Salary: <span className="font-mono text-emerald-600">{peso(employee.effective_daily_rate * 24)}</span>
                                                        </span>
                                                        <span className="text-muted">
                                                            Allowances: <span className="font-mono text-blue-600">{peso(employee.monthly_allowances)}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 gap-1.5">
                                                    <button
                                                        onClick={() => setSelected(employee)}
                                                        className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                        aria-label="View details"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="mt-3 ml-7 pl-4 border-l-2 border-accent/20 space-y-2"
                                                >
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                                        <div className="rounded-lg border border-line p-2">
                                                            <p className="text-[10px] text-muted font-rethink">Position Default</p>
                                                            <p className="font-mono text-ink">{peso(employee.position_default_daily_rate)}</p>
                                                        </div>
                                                        <div className="rounded-lg border border-line p-2">
                                                            <p className="text-[10px] text-muted font-rethink">Effective Rate</p>
                                                            <p className="font-mono font-semibold text-ink">{peso(employee.effective_daily_rate)}</p>
                                                        </div>
                                                        <div className="rounded-lg border border-line p-2">
                                                            <p className="text-[10px] text-muted font-rethink">Custom Rate</p>
                                                            <p className={`font-mono ${employee.is_custom_rate ? 'font-semibold text-amber-600' : 'text-muted'}`}>
                                                                {employee.custom_daily_rate ? peso(employee.custom_daily_rate) : '—'}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-lg border border-line p-2">
                                                            <p className="text-[10px] text-muted font-rethink">Monthly Salary</p>
                                                            <p className="font-mono font-semibold text-ink">{peso(employee.effective_daily_rate * 24)}</p>
                                                        </div>
                                                        <div className="rounded-lg border border-line p-2">
                                                            <p className="text-[10px] text-muted font-rethink">Monthly Allowances</p>
                                                            <p className="font-mono font-semibold text-blue-600">{peso(employee.monthly_allowances)}</p>
                                                        </div>
                                                        <div className="rounded-lg border border-line p-2">
                                                            <p className="text-[10px] text-muted font-rethink">Total Monthly</p>
                                                            <p className="font-mono font-semibold text-accent">{peso(employee.total_monthly_compensation)}</p>
                                                        </div>
                                                    </div>
                                                    {employee.salary_adjustment_reason && (
                                                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-800/30 dark:bg-amber-950/30">
                                                            <p className="text-[10px] text-amber-600 font-rethink">Reason for adjustment</p>
                                                            <p className="text-xs text-ink">{employee.salary_adjustment_reason}</p>
                                                        </div>
                                                    )}
                                                    {employee.incentives > 0 && (
                                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-800/30 dark:bg-emerald-950/30">
                                                            <p className="text-[10px] text-emerald-600 font-rethink">Incentives</p>
                                                            <p className="text-xs text-ink">{peso(employee.incentives)} - {employee.incentive_description || 'No description'}</p>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5 dark:border-line/30">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    itemsPerPage={PAGE_SIZE}
                                    totalItems={filteredEmployees.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {selected && (
                <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Employee Compensation Details" className="max-w-lg">
                    <div className="space-y-4 font-rethink">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-semibold text-ink">{selected.employee_name}</p>
                                <p className="text-xs text-muted">{selected.employee_id_number}</p>
                                {selected.job_title && <p className="text-xs text-muted mt-1">{selected.job_title}</p>}
                                {selected.department && <p className="text-xs text-muted">{selected.department}</p>}
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                                {selected.employee_status}
                            </span>
                        </div>

                        <div className="space-y-1.5 rounded-lg border border-line p-3.5 dark:border-line/30">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Position Default Rate</span>
                                <span className="text-sm font-mono text-ink">{peso(selected.position_default_daily_rate)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Custom Rate</span>
                                <span className={`text-sm font-mono ${selected.is_custom_rate ? 'font-semibold text-amber-600' : 'text-muted'}`}>
                                    {selected.custom_daily_rate ? peso(selected.custom_daily_rate) : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Effective Daily Rate</span>
                                <span className="text-sm font-mono font-semibold text-ink">{peso(selected.effective_daily_rate)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Monthly Salary</span>
                                <span className="text-sm font-mono font-semibold text-ink">{peso(selected.effective_daily_rate * 24)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Monthly Allowances</span>
                                <span className="text-sm font-mono font-semibold text-blue-600">{peso(selected.monthly_allowances)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Incentives</span>
                                <span className="text-sm font-mono font-semibold text-emerald-600">{peso(selected.incentives)}</span>
                            </div>
                            {selected.salary_adjustment_reason && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted">Reason</span>
                                    <span className="text-sm text-ink max-w-[200px] truncate">{selected.salary_adjustment_reason}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Date Hired</span>
                                <span className="text-sm text-ink">{new Date(selected.date_hired).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center justify-between rounded-lg bg-accent/10 border border-accent/20 px-4 py-3 dark:bg-accent/20">
                                <span className="text-sm font-medium text-accent">Monthly Total</span>
                                <span className="text-lg font-mono font-semibold text-accent">
                                    {peso((selected.effective_daily_rate * 24) + (selected.monthly_allowances) + (selected.incentives || 0))}
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200/60 px-4 py-3 dark:bg-emerald-950/30 dark:border-emerald-800/30">
                                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Annual Total</span>
                                <span className="text-lg font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                                    {peso(((selected.effective_daily_rate * 24) + (selected.monthly_allowances) + (selected.incentives || 0)) * 12)}
                                </span>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default EmployeeCompensationManager;