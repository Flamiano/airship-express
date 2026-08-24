'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Plus, Pencil, Trash2, Loader2, Search, X,
    Clock, Coffee, Zap, DollarSign
} from 'lucide-react';
import { Button } from '@/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/payroll-benefits-dashboard/components/ui/Alert';
import { Input } from '@/payroll-benefits-dashboard/components/ui/Input';
import { Badge } from '@/payroll-benefits-dashboard/components/ui/Badge';
import { Pagination } from '@/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/payroll-benefits-dashboard/hooks/api/useApi';

const PAGE_SIZE = 6;

const EMPTY_FORM = {
    job_position_id: '',
    daily_rate: '',
    hours_per_day: '8',
    break_hours: '1',
    overtime_rate: '1.25',
};

const JobPositionSettingsManager = () => {
    const [settings, setSettings] = useState<any[]>([]);
    const [jobPositions, setJobPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSetting, setEditingSetting] = useState<any>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/payroll/job-settings');
    const { fetchData: fetchJobPositions } = useApi('/payroll-benefits-dashboard/api/payroll/job-positions');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [settingsData, positionsData] = await Promise.all([
                fetchData(),
                fetchJobPositions()
            ]);
            setSettings(settingsData || []);
            setJobPositions(positionsData || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error("Load error:", error);
            toast.error(error?.message || 'Failed to load job settings');
        } finally {
            setLoading(false);
        }
    };

    const filteredSettings = useMemo(() => {
        if (!searchQuery) return settings;
        const query = searchQuery.toLowerCase();
        return settings.filter(
            (s) =>
                (s.hr1_job_positions?.title?.toLowerCase() || '').includes(query) ||
                (s.hr1_job_positions?.department?.toLowerCase() || '').includes(query)
        );
    }, [settings, searchQuery]);

    const sortedSettings = useMemo(() => {
        return [...filteredSettings].sort((a, b) =>
            (a.hr1_job_positions?.title || '').localeCompare(b.hr1_job_positions?.title || '')
        );
    }, [filteredSettings]);

    const totalPages = Math.max(1, Math.ceil(sortedSettings.length / PAGE_SIZE));

    const paginatedSettings = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedSettings.slice(start, start + PAGE_SIZE);
    }, [sortedSettings, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    const openCreate = () => {
        const unassigned = jobPositions.filter(
            (jp) => !settings.some((s) => s.job_position_id === jp.id)
        );
        if (unassigned.length === 0) {
            toast.error('All job positions already have settings');
            return;
        }
        setEditingSetting(null);
        setForm({
            ...EMPTY_FORM,
            job_position_id: unassigned[0].id
        });
        setIsModalOpen(true);
    };

    const openEdit = (setting: any) => {
        setEditingSetting(setting);
        setForm({
            job_position_id: setting.job_position_id,
            daily_rate: String(setting.daily_rate || ''),
            hours_per_day: String(setting.hours_per_day || '8'),
            break_hours: String(setting.break_hours || '1'),
            overtime_rate: String(setting.overtime_rate || '1.25'),
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.job_position_id) {
            toast.error('Job position is required');
            return;
        }
        if (!form.daily_rate || Number(form.daily_rate) < 0) {
            toast.error('Enter a valid daily rate');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                job_position_id: form.job_position_id,
                daily_rate: Number(form.daily_rate),
                hours_per_day: Number(form.hours_per_day) || 8,
                break_hours: Number(form.break_hours) || 1,
                overtime_rate: Number(form.overtime_rate) || 1.25,
            };

            if (editingSetting) {
                await putData(`/${editingSetting.id}`, payload);
                toast.success('Job setting updated');
            } else {
                await postData('', payload);
                toast.success('Job setting created');
            }
            setIsModalOpen(false);
            loadData();
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error(error?.message || 'Failed to save job setting');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.success('Job setting deleted');
            setDeleteTarget(null);
            loadData();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to delete job setting');
        } finally {
            setIsDeleting(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    };

    const unassignedJobPositions = useMemo(() => {
        const assignedIds = new Set(settings.map((s) => s.job_position_id));
        return jobPositions.filter((jp) => !assignedIds.has(jp.id));
    }, [jobPositions, settings]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                        <DollarSign className="h-4.5 w-4.5 text-accent" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold font-bricolage text-ink leading-tight">
                            Job Position Salary Settings
                        </h4>
                        <p className="text-xs text-muted font-rethink">
                            {settings.length} job position{settings.length === 1 ? '' : 's'} configured
                        </p>
                    </div>
                </div>
                <Button onClick={openCreate} size="sm" className="shrink-0 font-rethink">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Setting
                </Button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                    type="text"
                    placeholder="Search job positions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                    size="sm"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted font-rethink">
                    <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    Loading job settings…
                </div>
            ) : settings.length === 0 ? (
                <Alert variant="info" message="No job position settings configured yet. Add one to start." />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <AnimatePresence initial={false}>
                        {paginatedSettings.map((setting: any) => (
                            <motion.div
                                key={setting.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className="rounded-lg border border-line p-4 dark:border-line/30 hover:border-accent/30 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <h5 className="text-sm font-semibold text-ink font-rethink">
                                            {setting.hr1_job_positions?.title || 'Unknown Position'}
                                        </h5>
                                        <p className="text-xs text-muted font-rethink">
                                            {setting.hr1_job_positions?.department || 'No department'}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => openEdit(setting)}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors dark:border-blue-800/30 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(setting)}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-md bg-ink/[0.03] px-3 py-2 dark:bg-ink/[0.05]">
                                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted font-rethink">Daily Rate</p>
                                        <p className="text-sm font-mono font-semibold text-ink">{formatCurrency(setting.daily_rate)}</p>
                                    </div>
                                    <div className="rounded-md bg-ink/[0.03] px-3 py-2 dark:bg-ink/[0.05]">
                                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted font-rethink">Hours/Day</p>
                                        <p className="text-sm font-mono font-semibold text-ink flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5 text-muted" />
                                            {setting.hours_per_day}h
                                        </p>
                                    </div>
                                    <div className="rounded-md bg-ink/[0.03] px-3 py-2 dark:bg-ink/[0.05]">
                                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted font-rethink">Break</p>
                                        <p className="text-sm font-mono font-semibold text-ink flex items-center gap-1">
                                            <Coffee className="h-3.5 w-3.5 text-muted" />
                                            {setting.break_hours}h
                                        </p>
                                    </div>
                                    <div className="rounded-md bg-ink/[0.03] px-3 py-2 dark:bg-ink/[0.05]">
                                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted font-rethink">Overtime Rate</p>
                                        <p className="text-sm font-mono font-semibold text-ink flex items-center gap-1">
                                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                                            {setting.overtime_rate}x
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {totalPages > 1 && (
                <div className="border-t border-line pt-3 dark:border-line/30">
                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
            )}

            {/* Modal for Add/Edit */}
            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editingSetting ? 'Edit Job Position Settings' : 'Add Job Position Settings'}
                    className="max-w-lg"
                >
                    <div className="space-y-4">
                        {!editingSetting && (
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Job Position</label>
                                <select
                                    value={form.job_position_id}
                                    onChange={(e) => setForm((f) => ({ ...f, job_position_id: e.target.value }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30"
                                >
                                    {unassignedJobPositions.map((jp) => (
                                        <option key={jp.id} value={jp.id}>
                                            {jp.title} — {jp.department}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {editingSetting && (
                            <div>
                                <p className="mb-1.5 text-xs font-medium text-ink font-rethink">Job Position</p>
                                <p className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2 text-sm text-ink/80 font-rethink dark:border-line/30">
                                    {editingSetting.hr1_job_positions?.title || 'Unknown'}
                                </p>
                            </div>
                        )}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Daily Rate (₱)</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={form.daily_rate}
                                onChange={(e) => setForm((f) => ({ ...f, daily_rate: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                            />
                        </div>
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
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">OT Rate</label>
                                <Input
                                    type="number"
                                    step="0.05"
                                    value={form.overtime_rate}
                                    onChange={(e) => setForm((f) => ({ ...f, overtime_rate: e.target.value }))}
                                    className="font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                {isSaving ? (
                                    <>
                                        <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Saving…
                                    </>
                                ) : (
                                    'Save'
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Delete Modal */}
            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Job Position Setting"
                    className="max-w-md"
                >
                    <div className="space-y-5">
                        <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                Delete settings for {deleteTarget.hr1_job_positions?.title || 'this position'}?
                                This will remove the daily rate and hours configuration.
                            </p>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={isDeleting} className="w-full sm:w-auto font-rethink shadow-sm">
                                {isDeleting ? 'Deleting…' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default JobPositionSettingsManager;