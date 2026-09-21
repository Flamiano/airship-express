'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    FileText, BarChart3, PieChart, TrendingUp, Users,
    DollarSign, Calendar, Loader2, Printer, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { printTable, exportExcel, printFormatters, PrintColumn } from './print-utils';

const REPORT_TYPES = [
    { value: 'salary_distribution', label: 'Salary Distribution', icon: BarChart3 },
    { value: 'payroll_forecast', label: 'Payroll Forecast', icon: TrendingUp },
    { value: 'total_rewards', label: 'Total Rewards Summary', icon: PieChart },
    { value: 'budget_variance', label: 'Budget Variance', icon: DollarSign },
    { value: 'merit_review', label: 'Merit Review Summary', icon: Users },
    { value: 'compensation_ratio', label: 'Compensation Ratio', icon: FileText },
];

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const CompensationReports = () => {
    const toast = useToast();
    const [selectedReport, setSelectedReport] = useState<string>('salary_distribution');
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());

    const { fetchData } = useApi('/payroll-benefits-dashboard/api/compensation/reports');

    useEffect(() => {
        generateReport();
    }, [selectedReport, fiscalYear]);

    const generateReport = async () => {
        setLoading(true);
        try {
            const data = await fetchData(`?type=${selectedReport}&year=${fiscalYear}`);
            setReportData(data);
        } catch (error: any) {
            console.error('Report error:', error);
            toast.showError(error?.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setGenerating(true);
        try {
            toast.showSuccess('Report exported successfully');
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to export report');
        } finally {
            setGenerating(false);
        }
    };

    const getReportLabel = () =>
        REPORT_TYPES.find((r) => r.value === selectedReport)?.label || 'Report';

    const buildReportColumns = (): PrintColumn[] => {
        switch (selectedReport) {
            case 'salary_distribution':
                return [
                    { key: 'grade_code', label: 'Grade Code', format: (v) => printFormatters.text(v || 'No Grade') },
                    { key: 'grade_name', label: 'Grade Name', format: (v) => printFormatters.text(v) },
                    { key: 'employee_count', label: 'Employees', align: 'center' },
                    { key: 'avg_salary', label: 'Avg Salary', align: 'right', format: (v) => printFormatters.peso(v) },
                    { key: 'total_salary', label: 'Total Salary', align: 'right', format: (v) => printFormatters.peso(v) },
                ];

            case 'payroll_forecast':
                return [
                    { key: 'month', label: 'Month' },
                    { key: 'projected_payroll', label: 'Projected Payroll', align: 'right', format: (v) => printFormatters.peso(v) },
                    { key: 'actual_payroll', label: 'Actual Payroll', align: 'right', format: (v) => printFormatters.peso(v) },
                    { key: 'variance', label: 'Variance', align: 'right', format: (v) => printFormatters.peso(v) },
                ];

            case 'total_rewards':
                return [
                    { key: 'label', label: 'Component' },
                    { key: 'value', label: 'Amount', align: 'right' },
                ];

            case 'budget_variance':
                return [
                    { key: 'department', label: 'Department', format: (v) => printFormatters.text(v || 'Overall') },
                    { key: 'total_budget', label: 'Total Budget', align: 'right', format: (v) => printFormatters.peso(v) },
                    { key: 'actual_spent', label: 'Actual Spent', align: 'right', format: (v) => printFormatters.peso(v) },
                    { key: 'variance', label: 'Variance', align: 'right', format: (v) => printFormatters.peso(v) },
                    { key: 'utilization', label: 'Utilization', align: 'right', format: (v) => `${v}%` },
                ];

            case 'merit_review':
                return [
                    { key: 'status', label: 'Status' },
                    { key: 'count', label: 'Count', align: 'center' },
                    { key: 'total_amount', label: 'Total Amount', align: 'right', format: (v) => printFormatters.peso(v) },
                ];

            case 'compensation_ratio':
                return [
                    { key: 'employee_id', label: 'Employee ID' },
                    { key: 'grade_code', label: 'Grade', format: (v) => printFormatters.text(v || '—') },
                    { key: 'monthly_salary', label: 'Monthly Salary', align: 'right', format: (v) => printFormatters.peso(v) },
                    { key: 'mid_salary', label: 'Mid Salary', align: 'right', format: (v) => printFormatters.peso(v) },
                    { key: 'compa_ratio', label: 'Compa-Ratio', align: 'right', format: (v) => `${Number(v || 0).toFixed(1)}%` },
                ];

            default:
                return [];
        }
    };

    const buildReportRows = (): any[] => {
        if (!reportData) return [];
        switch (selectedReport) {
            case 'salary_distribution':
                return reportData.distribution || [];

            case 'payroll_forecast':
                return reportData.forecast || [];

            case 'total_rewards':
                return [
                    { label: 'Base Salary', value: printFormatters.peso(reportData.total_base_salary || 0) },
                    { label: 'Allowances', value: printFormatters.peso(reportData.total_allowances || 0) },
                    { label: 'Bonuses', value: printFormatters.peso(reportData.total_bonuses || 0) },
                    { label: 'Total Rewards', value: printFormatters.peso(reportData.total_rewards || 0) },
                ];

            case 'budget_variance':
                return reportData.plans || [];

            case 'merit_review':
                return [
                    {
                        status: 'Approved',
                        count: reportData.approved_count || 0,
                        total_amount: reportData.total_increase_amount || 0,
                    },
                    {
                        status: 'Pending',
                        count: reportData.pending_count || 0,
                        total_amount: 0,
                    },
                    {
                        status: 'Rejected',
                        count: reportData.rejected_count || 0,
                        total_amount: 0,
                    },
                ];

            case 'compensation_ratio':
                return reportData.employees || [];

            default:
                return [];
        }
    };

    const buildReportFilters = (): Record<string, string | number> => {
        const base: Record<string, string | number> = {
            'Report': getReportLabel(),
            'Fiscal Year': fiscalYear,
        };

        if (!reportData) return base;

        switch (selectedReport) {
            case 'salary_distribution':
                return {
                    ...base,
                    'Total Employees': reportData.total_employees || 0,
                    'Average Salary': printFormatters.peso(reportData.average_salary || 0),
                };

            case 'total_rewards':
                return {
                    ...base,
                    'Total Base': printFormatters.peso(reportData.total_base_salary || 0),
                    'Total Allowances': printFormatters.peso(reportData.total_allowances || 0),
                    'Total Bonuses': printFormatters.peso(reportData.total_bonuses || 0),
                    'Total Rewards': printFormatters.peso(reportData.total_rewards || 0),
                };

            case 'budget_variance':
                return {
                    ...base,
                    'Total Budget': printFormatters.peso(reportData.total_budget || 0),
                    'Actual Spent': printFormatters.peso(reportData.actual_spent || 0),
                    'Utilization': `${reportData.utilization || 0}%`,
                };

            case 'merit_review':
                return {
                    ...base,
                    'Total Plans': reportData.total_merit_plans || 0,
                    'Approved': reportData.approved_count || 0,
                    'Pending': reportData.pending_count || 0,
                };

            case 'compensation_ratio':
                return {
                    ...base,
                    'Total Employees': reportData.total_employees || 0,
                    'Average Compa-Ratio': `${Number(reportData.average_compa_ratio || 0).toFixed(1)}%`,
                };

            default:
                return base;
        }
    };

    const handlePrint = () => {
        const rows = buildReportRows();
        if (rows.length === 0) {
            toast.showError('No data available to print.');
            return;
        }

        printTable(
            {
                companyName: 'Airship Express',
                companyAddress: 'Binondo, Manila, Philippines',
                reportTitle: getReportLabel(),
                reportSubtitle: `Fiscal Year ${fiscalYear} — Compensation Planning Report`,
                filters: buildReportFilters(),
                logoPath: '/images/logo-remove-bg.png',
            },
            buildReportColumns(),
            rows
        );
    };

    const handleExportExcel = () => {
        const rows = buildReportRows();
        if (rows.length === 0) {
            toast.showError('No data available to export.');
            return;
        }

        exportExcel(
            `${selectedReport}-${fiscalYear}-${new Date().toISOString().split('T')[0]}`,
            buildReportColumns(),
            rows
        );
        toast.showSuccess(`${getReportLabel()} exported to Excel.`);
    };

    const renderReportContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
            );
        }

        if (!reportData) {
            return <Alert variant="info" message="No data available for this report." />;
        }

        switch (selectedReport) {
            case 'salary_distribution':
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Total Employees</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {reportData.total_employees || 0}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Average Salary</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {peso(reportData.average_salary || 0)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Min Salary</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {peso(reportData.min_salary || 0)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Max Salary</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {peso(reportData.max_salary || 0)}
                                </p>
                            </div>
                        </div>
                        {reportData.distribution && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-line">
                                            <th className="text-left py-2 text-[10px] font-semibold text-muted font-rethink">Grade</th>
                                            <th className="text-left py-2 text-[10px] font-semibold text-muted font-rethink">Employees</th>
                                            <th className="text-right py-2 text-[10px] font-semibold text-muted font-rethink">Avg Salary</th>
                                            <th className="text-right py-2 text-[10px] font-semibold text-muted font-rethink">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.distribution.map((item: any, i: number) => (
                                            <tr key={i} className="border-b border-line/50">
                                                <td className="py-2 text-xs text-ink font-rethink">{item.grade_code || 'No Grade'}</td>
                                                <td className="py-2 text-xs text-ink">{item.employee_count}</td>
                                                <td className="py-2 text-right text-xs font-mono text-ink">{peso(item.avg_salary)}</td>
                                                <td className="py-2 text-right text-xs font-mono text-ink">{peso(item.total_salary)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );

            case 'total_rewards':
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Base Salary</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {peso(reportData.total_base_salary || 0)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Allowances</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {peso(reportData.total_allowances || 0)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Bonuses</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {peso(reportData.total_bonuses || 0)}
                                </p>
                            </div>
                        </div>
                        <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-ink">Total Rewards</span>
                                <span className="text-xl font-mono font-bold text-accent">
                                    {peso(reportData.total_rewards || 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                );

            case 'budget_variance':
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Total Budget</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {peso(reportData.total_budget || 0)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Actual Spent</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {peso(reportData.actual_spent || 0)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Variance</p>
                                <p className={`text-lg font-semibold font-mono ${(reportData.variance || 0) < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {peso(reportData.variance || 0)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Utilization</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {reportData.utilization || 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'merit_review':
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Total Plans</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {reportData.total_merit_plans || 0}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Approved</p>
                                <p className="text-lg font-semibold font-mono text-emerald-600">
                                    {reportData.approved_count || 0}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Pending</p>
                                <p className="text-lg font-semibold font-mono text-amber-600">
                                    {reportData.pending_count || 0}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Total Increase</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {peso(reportData.total_increase_amount || 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'compensation_ratio':
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Total Employees</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {reportData.total_employees || 0}
                                </p>
                            </div>
                            <div className="rounded-lg border border-line p-3 text-center">
                                <p className="text-[10px] text-muted font-rethink">Average Compa-Ratio</p>
                                <p className="text-lg font-semibold font-mono text-ink">
                                    {Number(reportData.average_compa_ratio || 0).toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'payroll_forecast':
                return (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-line p-4 text-center">
                            <p className="text-sm text-muted font-rethink">
                                Payroll forecast data for FY {fiscalYear}
                            </p>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="py-8 text-center">
                        <FileText className="h-12 w-12 mx-auto text-muted" />
                        <p className="mt-3 text-sm text-muted font-rethink">
                            Report data will appear here
                        </p>
                    </div>
                );
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={selectedReport}
                        onChange={(e) => setSelectedReport(e.target.value)}
                        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 min-w-[180px]"
                    >
                        {REPORT_TYPES.map((report) => (
                            <option key={report.value} value={report.value}>
                                {report.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(Number(e.target.value))}
                        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                    >
                        {[2023, 2024, 2025, 2026].map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                    <Button
                        onClick={handlePrint}
                        variant="outline"
                        className="font-rethink text-sm h-[42px] px-4 rounded-lg"
                    >
                        <span className="flex flex-row items-center justify-center gap-2">
                            <Printer className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Print</span>
                        </span>
                    </Button>
                    <Button
                        onClick={handleExportExcel}
                        variant="outline"
                        className="font-rethink text-sm h-[42px] px-4 rounded-lg"
                    >
                        <span className="flex flex-row items-center justify-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Export Excel</span>
                        </span>
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={generating}
                        className="font-rethink text-sm h-[42px] px-4 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-2">
                            {generating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileText className="h-4 w-4 shrink-0" />
                            )}
                            <span className="whitespace-nowrap leading-none">
                                {generating ? 'Generating…' : 'Generate Report'}
                            </span>
                        </span>
                    </Button>
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                <CardBody className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            {REPORT_TYPES.find((r) => r.value === selectedReport)?.icon && (
                                <span className="text-accent">
                                    {React.createElement(
                                        REPORT_TYPES.find((r) => r.value === selectedReport)!.icon,
                                        { className: 'h-4 w-4' }
                                    )}
                                </span>
                            )}
                            <h4 className="text-sm font-semibold text-ink font-rethink">
                                {getReportLabel()}
                            </h4>
                            <span className="text-[10px] text-muted font-rethink bg-ink/[0.03] px-2 py-0.5 rounded-full border border-line">
                                FY {fiscalYear}
                            </span>
                        </div>
                        {!loading && reportData && (
                            <span className="text-[10px] text-muted font-rethink">
                                {reportData.record_count || 0} records
                            </span>
                        )}
                    </div>
                    {renderReportContent()}
                </CardBody>
            </Card>
        </div>
    );
};

export default CompensationReports;