'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Wallet, Loader2, Plus, Trash2, UserCircle2 } from 'lucide-react';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

const formatCurrency = (amount: number | null | undefined) =>
    `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const formatDate = (value: string | null | undefined) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return value;
    }
};

const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return value;
    }
};

interface PayrollRunOption {
    id: number;
    period_start: string;
    period_end: string;
    pay_schedule: string;
    status: string;
}

interface IncentiveEntry {
    id: string;
    payroll_run_id: number;
    amount: number;
    description: string | null;
    admin_name: string | null;
    created_at: string;
    period_start: string;
    period_end: string;
    is_active_now: boolean;
}

export function IncentivesModal({
    isOpen, onClose, employeeId, employeeName,
}: { isOpen: boolean; onClose: () => void; employeeId: string; employeeName: string }) {
    const [entries, setEntries] = useState<IncentiveEntry[]>([]);
    const [runs, setRuns] = useState<PayrollRunOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRunId, setSelectedRunId] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const { fetchData: fetchIncentives, postData } = useApi('/payroll-benefits-dashboard/api/payroll/incentives');
    const { fetchData: fetchRuns } = useApi('/payroll-benefits-dashboard/api/payroll/runs');
    const { deleteData } = useApi('/payroll-benefits-dashboard/api/payroll/incentives');

    useEffect(() => {
        if (!isOpen) return;
        load();
    }, [isOpen, employeeId]);

    const load = async () => {
        setLoading(true);
        try {
            const [incentiveData, runData] = await Promise.all([
                fetchIncentives(`?employee_id=${employeeId}`),
                fetchRuns(),
            ]);
            setEntries(incentiveData || []);
            setRuns((runData || []).filter((r: PayrollRunOption) => r.status !== 'voided'));
        } catch (error: any) {
            toast.error(error?.message || 'Failed to load incentives');
        } finally {
            setLoading(false);
        }
    };

    const activeTotal = useMemo(
        () => entries.filter((e) => e.is_active_now).reduce((s, e) => s + e.amount, 0),
        [entries]
    );

    const handleGrant = async () => {
        if (!selectedRunId) {
            toast.warning('Select a payroll run first');
            return;
        }
        const numericAmount = Number(amount);
        if (!numericAmount || numericAmount <= 0) {
            toast.warning('Enter a valid amount');
            return;
        }

        setIsSaving(true);
        try {
            await postData('', {
                employee_id: employeeId,
                payroll_run_id: Number(selectedRunId),
                amount: numericAmount,
                description: description.trim() || null,
            });
            toast.success('Incentive granted');
            setSelectedRunId('');
            setAmount('');
            setDescription('');
            load();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to grant incentive');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRevoke = async (id: string) => {
        setRemovingId(id);
        try {
            await deleteData(`/${id}`);
            toast.success('Incentive removed');
            load();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to remove incentive');
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Incentives — ${employeeName}`} className="max-w-xl" variant="success">
            <div className="space-y-5">
                <div className="rounded-lg border border-philhealth/20 bg-philhealth-soft p-3 flex items-center justify-between">
                    <p className="text-xs font-medium text-philhealth font-rethink">Currently Active (this pay period)</p>
                    <p className="text-sm font-mono font-semibold text-philhealth">{formatCurrency(activeTotal)}</p>
                </div>

                <div className="rounded-lg border border-line bg-ink/[0.02] p-3.5 space-y-3">
                    <p className="text-xs font-semibold text-ink font-rethink">Grant New Incentive</p>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Payroll Run</label>
                        <select
                            value={selectedRunId}
                            onChange={(e) => setSelectedRunId(e.target.value)}
                            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink font-rethink outline-none focus:ring-2 focus:ring-accent/30"
                        >
                            <option value="">Select a run…</option>
                            {runs.map((run) => (
                                <option key={run.id} value={run.id}>
                                    {formatDate(run.period_start)} – {formatDate(run.period_end)} ({run.status})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Amount</label>
                            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="font-mono" />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Description</label>
                            <Input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. SILP" />
                        </div>
                    </div>
                    <Button
                        type="button"
                        onClick={handleGrant}
                        disabled={isSaving}
                        loading={isSaving}
                        variant="success"
                        size="lg"
                        fullWidth
                        leftIcon={!isSaving && <Plus className="h-4 w-4" />}
                        className="font-rethink font-semibold shadow-sm"
                    >
                        {isSaving ? 'Granting…' : 'Grant Incentive'}
                    </Button>
                </div>

                <div>
                    <p className="mb-2 text-xs font-semibold text-ink font-rethink">History</p>
                    {loading ? (
                        <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted font-rethink">
                            <Loader2 className="h-5 w-5 animate-spin text-ink/40" />
                            Loading…
                        </div>
                    ) : entries.length === 0 ? (
                        <Alert variant="info" message="No incentives granted yet." />
                    ) : (
                        <div className="space-y-2.5 max-h-72 overflow-y-auto">
                            {entries.map((entry) => (
                                <div key={entry.id} className="rounded-lg border border-line bg-ink/[0.02] p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <Wallet className="h-3.5 w-3.5 text-philhealth shrink-0" />
                                                <p className="text-sm font-mono font-semibold text-ink">{formatCurrency(entry.amount)}</p>
                                                {entry.is_active_now ? (
                                                    <span className="inline-flex items-center rounded-full bg-philhealth-soft px-2 py-0.5 text-[10px] font-medium text-philhealth">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-muted">
                                                        Past
                                                    </span>
                                                )}
                                            </div>
                                            {entry.description && (
                                                <p className="mt-1 text-xs text-ink/70 font-rethink">{entry.description}</p>
                                            )}
                                            <p className="mt-1 text-[11px] text-muted font-rethink">
                                                {formatDate(entry.period_start)} – {formatDate(entry.period_end)}
                                            </p>
                                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted font-rethink">
                                                <UserCircle2 className="h-3 w-3 text-accent" />
                                                {entry.admin_name || 'Unknown Admin'} · {formatDateTime(entry.created_at)}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRevoke(entry.id)}
                                            disabled={removingId === entry.id}
                                            className="group shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100 hover:border-red-300 active:bg-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                                            aria-label="Remove incentive"
                                            title="Remove incentive"
                                        >
                                            {removingId === entry.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}