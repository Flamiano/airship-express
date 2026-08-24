'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Loader2, Wallet, Building2, Users, Clock } from 'lucide-react';
import { Button } from '@/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/payroll-benefits-dashboard/components/ui/Pagination';
import { Badge } from '@/payroll-benefits-dashboard/components/ui/Badge';
import { useApi } from '@/payroll-benefits-dashboard/hooks/api/useApi';

const PAGE_SIZE = 8;

const peso = (n: number) => {
    if (n === null || n === undefined) return '₱0.00';
    return `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

interface PayslipManagerProps {
    run: any;
    onBack: () => void;
}

const PayslipManager = ({ run, onBack }: PayslipManagerProps) => {
    const [payslips, setPayslips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [showCompanyShare, setShowCompanyShare] = useState(false);
    const { fetchData } = useApi(`/payroll-benefits-dashboard/api/payroll/runs/${run.id}/payslips`);

    useEffect(() => {
        loadPayslips();
    }, [run.id]);

    const loadPayslips = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setPayslips(data || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error("Load payslips error:", error);
            toast.error(error?.message || 'Failed to load payslips');
        } finally {
            setLoading(false);
        }
    };

    const totals = useMemo(
        () =>
            payslips.reduce(
                (acc, p) => ({
                    gross: acc.gross + Number(p.gross_pay || 0),
                    deductions: acc.deductions + Number(p.total_deductions || 0),
                    net: acc.net + Number(p.net_pay || 0),
                    employeeCount: acc.employeeCount + 1,
                    totalHours: acc.totalHours + Number(p.hours_worked || 0),
                }),
                { gross: 0, deductions: 0, net: 0, employeeCount: 0, totalHours: 0 }
            ),
        [payslips]
    );

    const totalPages = Math.max(1, Math.ceil(payslips.length / PAGE_SIZE));

    const paginatedPayslips = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return payslips.slice(start, start + PAGE_SIZE);
    }, [payslips, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    const formatDate = (value: string) => {
        if (!value) return '';
        try {
            return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return value;
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-ink/70 hover:bg-ink/5 transition-colors dark:border-line/30"
                        aria-label="Back to payroll runs"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                            <Wallet className="h-4.5 w-4.5 text-accent" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold font-bricolage text-ink leading-tight">
                                Payslips — {formatDate(run.period_start)} to {formatDate(run.period_end)}
                            </h3>
                            <p className="text-xs text-muted font-rethink capitalize">{run.status}</p>
                        </div>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompanyShare(!showCompanyShare)}
                    className="font-rethink"
                >
                    <Building2 className="h-4 w-4 mr-1.5" />
                    {showCompanyShare ? 'Hide' : 'Show'} Company Share
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-line bg-paper p-3.5 dark:border-line/30">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted font-rethink">Total Gross</p>
                    <p className="mt-1 text-lg font-mono font-semibold text-ink">{peso(totals.gross)}</p>
                </div>
                <div className="rounded-lg border border-line bg-paper p-3.5 dark:border-line/30">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted font-rethink">Total Deductions</p>
                    <p className="mt-1 text-lg font-mono font-semibold text-red-600">{peso(totals.deductions)}</p>
                </div>
                <div className="rounded-lg border border-line bg-paper p-3.5 dark:border-line/30">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted font-rethink">Total Net Pay</p>
                    <p className="mt-1 text-lg font-mono font-semibold text-emerald-600">{peso(totals.net)}</p>
                </div>
                <div className="rounded-lg border border-line bg-paper p-3.5 dark:border-line/30">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted font-rethink">Employees</p>
                    <p className="mt-1 text-lg font-mono font-semibold text-ink flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted" />
                        {totals.employeeCount}
                    </p>
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading payslips…
                    </div>
                ) : payslips.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert
                            variant="info"
                            message={
                                run.status === 'draft'
                                    ? 'Process this run to generate payslips.'
                                    : run.status === 'voided'
                                        ? 'This run has been voided. No payslips available.'
                                        : 'No payslips found for this run.'
                            }
                        />
                    </CardBody>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-line bg-paper dark:border-line/30">
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Employee
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Basic Pay
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Gross Pay
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Deductions
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Net Pay
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedPayslips.map((slip: any) => (
                                            <motion.tr
                                                key={slip.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.015] dark:border-line/30 dark:hover:bg-ink/[0.05]"
                                            >
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <p className="text-sm font-medium text-ink font-rethink">
                                                        {slip.employee_name || slip.employee_id}
                                                    </p>
                                                    {slip.employee_id_number && (
                                                        <p className="text-[11px] text-muted font-rethink">{slip.employee_id_number}</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-ink/80 whitespace-nowrap">
                                                    {peso(slip.basic_pay)}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-ink/80 whitespace-nowrap">
                                                    {peso(slip.gross_pay)}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-red-600 whitespace-nowrap">
                                                    -{peso(slip.total_deductions)}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {peso(slip.net_pay)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={() => setSelected(slip)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-ink/70 hover:bg-ink/5 transition-colors dark:border-line/30"
                                                            aria-label="View payslip breakdown"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden space-y-2.5 p-3">
                            <AnimatePresence initial={false}>
                                {paginatedPayslips.map((slip: any) => (
                                    <motion.div
                                        key={slip.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5 dark:border-line/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-ink font-rethink">
                                                    {slip.employee_name || slip.employee_id}
                                                </p>
                                                <p className="text-[11px] text-muted font-rethink">{slip.employee_id_number}</p>
                                            </div>
                                            <p className="shrink-0 text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                {peso(slip.net_pay)}
                                            </p>
                                        </div>
                                        <div className="mt-3 flex justify-end border-t border-line pt-2.5 dark:border-line/30">
                                            <Button size="sm" variant="outline" onClick={() => setSelected(slip)}>
                                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                View breakdown
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5 dark:border-line/30">
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* Payslip Breakdown Modal */}
            {selected && (
                <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Payslip Breakdown" className="max-w-2xl">
                    <div className="space-y-4 font-rethink">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-semibold text-ink">{selected.employee_name || selected.employee_id}</p>
                                {selected.employee_id_number && <p className="text-xs text-muted">{selected.employee_id_number}</p>}
                            </div>
                            <Badge variant="outline" className="bg-ink/5 text-ink/70 border-line dark:bg-ink/10 dark:border-line/30">
                                {selected.days_worked || 0} days worked
                            </Badge>
                        </div>

                        <div className="space-y-1.5 rounded-lg border border-line p-3.5 dark:border-line/30">
                            <Row label="Basic pay" value={peso(selected.basic_pay)} />
                            <Row label="Gross pay" value={peso(selected.gross_pay)} bold />
                        </div>

                        <div className="space-y-1.5 rounded-lg border border-line p-3.5 dark:border-line/30">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Employee Deductions</p>
                            <Row label="SSS" value={peso(selected.sss_employee_share)} />
                            <Row label="PhilHealth" value={peso(selected.philhealth_employee_share)} />
                            <Row label="Pag-IBIG" value={peso(selected.pagibig_employee_share)} />
                            <Row label="Withholding tax" value={peso(selected.withholding_tax)} />
                            <Row label="Other deductions" value={peso(selected.other_deductions)} />
                            <Row label="Total deductions" value={peso(selected.total_deductions)} bold />
                        </div>

                        {showCompanyShare && (
                            <div className="space-y-1.5 rounded-lg border border-blue-200 bg-blue-50/50 p-3.5 dark:border-blue-800/30 dark:bg-blue-950/30">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5" />
                                    Company Share (Admin View)
                                </p>
                                <Row label="SSS (Employer)" value={peso(selected.sss_employer_share)} />
                                <Row label="PhilHealth (Employer)" value={peso(selected.philhealth_employer_share)} />
                                <Row label="Pag-IBIG (Employer)" value={peso(selected.pagibig_employer_share)} />
                            </div>
                        )}

                        <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200/60 px-4 py-3 dark:bg-emerald-950/30 dark:border-emerald-800/30">
                            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Net pay</span>
                            <span className="text-lg font-mono font-semibold text-emerald-700 dark:text-emerald-300">{peso(selected.net_pay)}</span>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowCompanyShare(!showCompanyShare)}
                                className="font-rethink"
                            >
                                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                                {showCompanyShare ? 'Hide' : 'Show'} Company Share
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className={bold ? 'text-sm font-medium text-ink' : 'text-sm text-muted'}>{label}</span>
            <span className={bold ? 'text-sm font-mono font-semibold text-ink' : 'text-sm font-mono text-ink/80'}>{value}</span>
        </div>
    );
}

export default PayslipManager;