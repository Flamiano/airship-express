'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Pencil,
    Briefcase,
    Loader2,
    Search,
    CheckCircle2,
    XCircle,
    Clock3,
    TrendingUp,
    History,
    UserCircle2,
    Plus,
    Trash2,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { HistoryModal, StatCard, cssVar, formatCurrency } from './shared';

interface PositionRow {
    id: string;
    job_position_id: string;
    title: string;
    department: string;
    daily_rate: number;
    basic_salary: number;
    hours_per_day: number;
    break_hours: number;
    overtime_rate: number;
    is_active: boolean;
    last_modified_by_name: string | null;
    edited_by?: string | null;
    created_at: string;
    updated_at: string;
}

const PAGE_SIZE = 8;

interface SettingsForm {
    daily_rate: string;
    hours_per_day: string;
    break_hours: string;
    overtime_rate: string;
}

const EMPTY_SETTINGS_FORM: SettingsForm = {
    daily_rate: '',
    hours_per_day: '8',
    break_hours: '1',
    overtime_rate: '1.25',
};

const ByJobPosition = () => {
    const [positions, setPositions] = useState<PositionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<PositionRow | null>(null);
    const [form, setForm] = useState<SettingsForm>(EMPTY_SETTINGS_FORM);
    const [isSaving, setIsSaving] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<PositionRow | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyEntries, setHistoryEntries] = useState<any[]>([]);
    const [historyTitle, setHistoryTitle] = useState('');

    const { fetchData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/payroll/job-settings');
    const { fetchData: fetchHistory } = useApi('/payroll-benefits-dashboard/api/payroll/rate-history');

    const rankChartRef = useRef<HTMLCanvasElement | null>(null);
    const rankChartInstanceRef = useRef<Chart | null>(null);
    const modalChartRef = useRef<HTMLCanvasElement | null>(null);
    const modalChartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        loadPositions();
    }, []);

    const loadPositions = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setPositions(data || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error('Load error:', error);
            toast.error(error?.message || 'Unable to load job position settings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const openHistory = async (position: PositionRow) => {
        setHistoryTitle(`Edit History — ${position.title}`);
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const data = await fetchHistory(`?job_position_id=${position.job_position_id}`);
            setHistoryEntries(data || []);
        } catch (error: any) {
            toast.error(error?.message || 'Unable to load edit history. Please try again.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const openEdit = (position: PositionRow) => {
        setEditingPosition(position);
        setForm({
            daily_rate: position.daily_rate ? String(position.daily_rate) : '',
            hours_per_day: String(position.hours_per_day || 8),
            break_hours: String(position.break_hours || 1),
            overtime_rate: String(position.overtime_rate || 1.25),
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingPosition) return;
        if (!form.daily_rate || Number(form.daily_rate) <= 0) {
            toast.warning('Please enter a valid daily rate greater than 0.');
            return;
        }

        setIsSaving(true);
        try {
            await putData(`/${editingPosition.job_position_id}`, {
                daily_rate: Number(form.daily_rate),
                hours_per_day: Number(form.hours_per_day) || 8,
                break_hours: Number(form.break_hours) || 1,
                overtime_rate: Number(form.overtime_rate) || 1.25,
            });
            toast.success('Job position settings have been saved successfully.');
            setIsModalOpen(false);
            loadPositions();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.error(error?.message || 'Unable to save job position settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`?id=${deleteTarget.id}`);
            toast.success('Job position setting has been deleted successfully.');
            setDeleteTarget(null);
            loadPositions();
        } catch (error: any) {
            toast.error(error?.message || 'Unable to delete job position setting. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredPositions = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return positions.filter(
            (p) =>
                p.title?.toLowerCase().includes(term) ||
                p.department?.toLowerCase().includes(term)
        );
    }, [positions, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredPositions.length / PAGE_SIZE));

    const paginatedPositions = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredPositions.slice(start, start + PAGE_SIZE);
    }, [filteredPositions, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const rated = positions.filter((p) => p.daily_rate > 0);
    const avgRate = rated.length ? rated.reduce((s, p) => s + p.daily_rate, 0) / rated.length : 0;
    const openCount = positions.filter((p) => p.is_active).length;
    const unsetCount = positions.filter((p) => p.daily_rate <= 0).length;

    useEffect(() => {
        if (loading || !rankChartRef.current) return;
        const top = [...rated].sort((a, b) => b.daily_rate - a.daily_rate).slice(0, 6);

        rankChartInstanceRef.current?.destroy();
        if (top.length === 0) return;

        rankChartInstanceRef.current = new Chart(rankChartRef.current, {
            type: 'bar',
            data: {
                labels: top.map((p) => p.title),
                datasets: [
                    {
                        label: 'Daily Rate',
                        data: top.map((p) => p.daily_rate),
                        backgroundColor: cssVar('--accent', '#e5167e'),
                        borderRadius: 6,
                        barThickness: 22,
                    },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `₱${Number(ctx.raw).toLocaleString()}`,
                        },
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: (v) => `₱${v}`, color: cssVar('--muted', '#6b6b76'), font: { size: 10 } },
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
            rankChartInstanceRef.current?.destroy();
        };
    }, [positions, loading]);

    useEffect(() => {
        if (!isModalOpen || !editingPosition || !modalChartRef.current) return;
        const proposedRate = Number(form.daily_rate) || editingPosition.daily_rate;

        modalChartInstanceRef.current?.destroy();
        modalChartInstanceRef.current = new Chart(modalChartRef.current, {
            type: 'bar',
            data: {
                labels: ['Current Rate', 'New Rate'],
                datasets: [
                    {
                        data: [editingPosition.daily_rate, proposedRate],
                        backgroundColor: [
                            cssVar('--muted', '#6b6b76'),
                            proposedRate > editingPosition.daily_rate
                                ? cssVar('--philhealth', '#0b8f6b')
                                : proposedRate < editingPosition.daily_rate
                                    ? cssVar('--pagibig', '#b8720e')
                                    : cssVar('--accent', '#e5167e'),
                        ],
                        borderRadius: 6,
                        barThickness: 40,
                    },
                ],
            },
            options: {
                responsive: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => `₱${v}`, color: cssVar('--muted', '#6b6b76') },
                        grid: { color: cssVar('--line', '#eaeaea') },
                    },
                    x: { ticks: { color: cssVar('--ink', '#1c1b1f') }, grid: { display: false } },
                },
            },
        });
        return () => {
            modalChartInstanceRef.current?.destroy();
        };
    }, [isModalOpen, editingPosition, form.daily_rate]);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={Briefcase} label="Total Positions" value={String(positions.length)} tint="blue" />
                <StatCard icon={CheckCircle2} label="Open for Hiring" value={String(openCount)} tint="emerald" />
                <StatCard icon={TrendingUp} label="Avg. Daily Rate" value={formatCurrency(avgRate)} tint="purple" />
                <StatCard icon={XCircle} label="Rate Not Set" value={String(unsetCount)} tint="amber" />
            </div>

            {rated.length > 0 && (
                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden transition-colors duration-300">
                    <CardBody className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-ink font-rethink">Top Daily Rates by Position</p>
                            <span className="text-[10px] text-muted font-rethink">
                                Top {Math.min(rated.length, 6)} of {rated.length}
                            </span>
                        </div>
                        <div style={{ height: Math.min(rated.length, 6) * 38 + 20 }}>
                            <canvas ref={rankChartRef} />
                        </div>
                    </CardBody>
                </Card>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-muted font-rethink bg-ink/[0.03] px-2.5 py-1 rounded-full border border-line w-fit transition-colors duration-300">
                    <Clock3 className="h-3 w-3 text-accent" />
                    <span>Basic salary is calculated as Daily Rate × 24</span>
                </div>
            </div>

            <div className="flex items-center gap-2 border border-line rounded-lg bg-paper px-3 shadow-sm transition-colors duration-300">
                <Search className="h-4 w-4 text-muted" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by position title or department…"
                    className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-muted"
                />
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden transition-colors duration-300">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-muted" />
                        Loading job positions…
                    </div>
                ) : filteredPositions.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert
                            variant="info"
                            message={
                                positions.length === 0
                                    ? 'No job position settings are currently configured. Job positions are created in Recruitment — add one there first, then configure its salary here.'
                                    : 'No positions match your search. Try a different title or department.'
                            }
                        />
                    </CardBody>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] transition-colors duration-300">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Position</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden md:table-cell">Department</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Daily Rate</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Forecast M.Salary</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">O.T.</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Status</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden xl:table-cell">Edited By</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedPositions.map((position) => (
                                            <motion.tr
                                                key={position.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.02]"
                                            >
                                                <td className="px-3 py-2.5 text-[13px] font-medium text-ink font-rethink whitespace-nowrap max-w-[140px] truncate">
                                                    {position.title}
                                                </td>
                                                <td className="px-3 py-2.5 text-[13px] text-ink font-rethink whitespace-nowrap hidden md:table-cell max-w-[120px] truncate">
                                                    {position.department}
                                                </td>
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                    {position.daily_rate > 0 ? (
                                                        <span className="font-mono font-semibold text-[13px] text-ink">
                                                            {formatCurrency(position.daily_rate)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted italic text-[12px]">Not set</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                    {position.daily_rate > 0 ? (
                                                        <span className="font-mono font-semibold text-[13px] text-accent">
                                                            {formatCurrency(position.basic_salary)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted text-[12px]">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-ink whitespace-nowrap hidden lg:table-cell">
                                                    {position.overtime_rate}x
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell">
                                                    {position.is_active ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-philhealth">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Open
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                                                            <XCircle className="h-3 w-3" />
                                                            Closed
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell max-w-[130px]">
                                                    {position.edited_by ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink font-rethink truncate">
                                                            <UserCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                                                            <span className="truncate">{position.edited_by}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-muted italic font-rethink">
                                                            Never edited
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <div className="inline-flex items-center gap-1">
                                                        <button
                                                            onClick={() => openHistory(position)}
                                                            className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                            aria-label="View edit history"
                                                        >
                                                            <History className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(position)}
                                                            className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                                                            aria-label="Delete setting"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => openEdit(position)}
                                                            className="inline-flex items-center rounded-md border border-accent/20 bg-accent/5 px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
                                                        >
                                                            <Pencil className="h-3 w-3 mr-1" />
                                                            {position.daily_rate > 0 ? 'Edit' : 'Set'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-3 py-3 transition-colors duration-300">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    itemsPerPage={PAGE_SIZE}
                                    totalItems={filteredPositions.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {isModalOpen && editingPosition && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={`Set Rate — ${editingPosition.title}`}
                    className="max-w-lg"
                    accent="pink"
                    icon={Briefcase}
                    footer={
                        <div className="flex flex-row items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                disabled={isSaving}
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="font-rethink"
                            >
                                {isSaving ? 'Saving…' : 'Save Changes'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <p className="mb-1.5 text-xs font-medium text-ink font-rethink">Position</p>
                            <p className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2 text-sm text-ink font-rethink transition-colors duration-300 dark:bg-ink/[0.05]">
                                {editingPosition.title}
                            </p>
                            <p className="mt-1 text-[10px] text-muted font-rethink">{editingPosition.department}</p>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Daily Rate</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={form.daily_rate}
                                onChange={(e) => setForm((f) => ({ ...f, daily_rate: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                            />
                        </div>
                        {Number(form.daily_rate) > 0 && (
                            <div className="rounded-lg bg-accent/5 border border-accent/20 dark:bg-accent/10 dark:border-accent/30 p-3 flex items-center justify-between transition-colors duration-300">
                                <p className="text-xs font-medium text-accent font-rethink">Calculated Basic Salary (Monthly)</p>
                                <p className="text-sm font-mono font-semibold text-accent">
                                    {formatCurrency(Number(form.daily_rate) * 24)}
                                </p>
                            </div>
                        )}

                        {editingPosition.daily_rate > 0 && (
                            <div className="flex flex-col items-center rounded-lg border border-line bg-ink/[0.02] p-3 transition-colors duration-300 dark:bg-ink/[0.05]">
                                <canvas ref={modalChartRef} width={260} height={140} />
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Hours/Day</label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    value={form.hours_per_day}
                                    onChange={(e) => setForm((f) => ({ ...f, hours_per_day: e.target.value }))}
                                    className="font-mono"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Break (hrs)</label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    value={form.break_hours}
                                    onChange={(e) => setForm((f) => ({ ...f, break_hours: e.target.value }))}
                                    className="font-mono"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">OT Multiplier</label>
                                <Input
                                    type="number"
                                    step="0.05"
                                    value={form.overtime_rate}
                                    onChange={(e) => setForm((f) => ({ ...f, overtime_rate: e.target.value }))}
                                    className="font-mono"
                                />
                            </div>
                        </div>

                        {editingPosition.edited_by && (
                            <p className="text-[11px] text-muted font-rethink">
                                Last edited by <span className="text-ink font-medium">{editingPosition.edited_by}</span>
                            </p>
                        )}
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Position Setting"
                    className="max-w-md"
                    accent="red"
                    icon={Trash2}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="w-full sm:w-auto font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="w-full sm:w-auto font-rethink"
                            >
                                {isDeleting ? 'Deleting…' : 'Delete Setting'}
                            </Button>
                        </div>
                    }
                >
                    <p className="text-sm text-ink font-rethink leading-relaxed">
                        Delete the salary setting for <strong>{deleteTarget.title}</strong>? This removes the daily rate,
                        hours per day, break hours, and overtime multiplier for this position. Employees without a custom
                        rate will fall back to zero until a new setting is configured.
                    </p>
                </Modal>
            )}

            <HistoryModal
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                title={historyTitle}
                entries={historyEntries}
                loading={historyLoading}
            />
        </div>
    );
};

export default ByJobPosition;