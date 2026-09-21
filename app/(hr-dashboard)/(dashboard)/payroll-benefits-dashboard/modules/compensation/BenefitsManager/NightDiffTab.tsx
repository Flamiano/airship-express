'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Loader2, Moon, CheckCircle2, Coins, Save, Clock3, Sparkles, TrendingUp,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { StatCard } from './shared';

const DEFAULT_FORM = {
    night_diff_start: '22:00',
    night_diff_end: '04:00',
    night_diff_rate: '1.10',
    deduct_from_payroll: true,
    is_active: true,
};

const NightDiffTab = () => {
    const toast = useToast();
    const [form, setForm] = useState(DEFAULT_FORM);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastEditedBy, setLastEditedBy] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const { fetchData, putData } = useApi(
        '/payroll-benefits-dashboard/api/compensation/night-diff'
    );

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            if (data && !Array.isArray(data)) {
                setForm({
                    night_diff_start: String(data.night_diff_start || '22:00').slice(0, 5),
                    night_diff_end: String(data.night_diff_end || '04:00').slice(0, 5),
                    night_diff_rate: String(data.night_diff_rate || 1.1),
                    deduct_from_payroll: data.deduct_from_payroll ?? true,
                    is_active: data.is_active ?? true,
                });
                setLastEditedBy(data.last_modified_by_name || null);
                setLastUpdated(data.updated_at || null);
            }
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to load night differential settings');
        } finally { setLoading(false); }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const data = await putData('', {
                night_diff_start: form.night_diff_start,
                night_diff_end: form.night_diff_end,
                night_diff_rate: Number(form.night_diff_rate) || 1.1,
                deduct_from_payroll: form.deduct_from_payroll,
                is_active: form.is_active,
            });
            toast.showSuccess('Night differential settings saved');
            setLastEditedBy(data?.last_modified_by_name || null);
            setLastUpdated(data?.updated_at || null);
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to save settings');
        } finally { setIsSaving(false); }
    };

    const rateValue = Number(form.night_diff_rate) || 1.1;
    const premiumPercent = ((rateValue - 1) * 100).toFixed(0);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Moon} label="Scope" value="All Employees" tint="purple" />
                <StatCard icon={CheckCircle2} label="Premium" value={`${premiumPercent}%`} tint="emerald" />
                <StatCard icon={Coins} label="Multiplier" value={`${rateValue.toFixed(2)}x`} tint="amber" />
                <StatCard icon={Clock3} label="Window" value={`${form.night_diff_start} – ${form.night_diff_end}`} tint="blue" />
            </div>

            <Alert
                variant="info"
                message="Night differential is global — the same window and premium apply to every employee. Pay is computed automatically from attendance clock in / clock out during payroll processing."
            />

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                <div className="relative bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-5 py-4">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                    <div className="relative flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                            <Moon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white font-rethink">Global Night Differential Rule</h3>
                            <p className="text-[11px] text-white/80 font-rethink">Applies to every employee during payroll processing</p>
                        </div>
                        <div className="ml-auto hidden sm:flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 ring-1 ring-white/30">
                            <Sparkles className="h-3 w-3 text-white" />
                            <span className="text-[11px] font-medium text-white font-rethink">
                                {premiumPercent}% premium
                            </span>
                        </div>
                    </div>
                </div>

                <CardBody className="p-5 sm:p-6">
                    {loading ? (
                        <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                            <Loader2 className="h-5 w-5 animate-spin text-accent" />
                            Loading night differential settings…
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="rounded-xl border border-line bg-ink/[0.02] p-4 dark:bg-ink/[0.04]">
                                <p className="text-[10px] uppercase tracking-wider text-muted font-rethink mb-2">Active Window Preview</p>
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-lg font-bold text-ink">{form.night_diff_start}</span>
                                    <div className="flex-1 relative h-2 rounded-full bg-ink/10 dark:bg-ink/20 overflow-hidden">
                                        <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-purple-500/30 via-indigo-500 to-purple-500/30" />
                                    </div>
                                    <span className="font-mono text-lg font-bold text-ink">{form.night_diff_end}</span>
                                </div>
                                <p className="mt-2 text-[11px] text-muted font-rethink">
                                    Hours worked between these times receive the {premiumPercent}% premium on top of the base hourly rate.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Start Time</label>
                                    <Input
                                        type="time"
                                        value={form.night_diff_start}
                                        onChange={(e) => setForm((f) => ({ ...f, night_diff_start: e.target.value }))}
                                        leftIcon={<Clock3 className="h-4 w-4 text-purple-500" />}
                                        className="font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">End Time</label>
                                    <Input
                                        type="time"
                                        value={form.night_diff_end}
                                        onChange={(e) => setForm((f) => ({ ...f, night_diff_end: e.target.value }))}
                                        leftIcon={<Clock3 className="h-4 w-4 text-indigo-500" />}
                                        className="font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Premium Multiplier</label>
                                <Input
                                    type="number"
                                    min="1"
                                    step="0.05"
                                    value={form.night_diff_rate}
                                    onChange={(e) => setForm((f) => ({ ...f, night_diff_rate: e.target.value }))}
                                    leftIcon={<TrendingUp className="h-4 w-4 text-purple-500" />}
                                    rightIcon={
                                        <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                            +{premiumPercent}%
                                        </span>
                                    }
                                    className="font-mono"
                                />
                                <p className="mt-1 text-[10px] text-muted font-rethink">
                                    1.10 = 10% premium per PH Labor Code. Applied to hours worked between the window on top of the base hourly rate.
                                </p>
                            </div>

                            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-800/30 dark:bg-amber-950/20 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-ink font-rethink">Counted on payroll</span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={form.deduct_from_payroll}
                                        onClick={() => setForm((f) => ({ ...f, deduct_from_payroll: !f.deduct_from_payroll }))}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-paper dark:focus:ring-offset-ink ${form.deduct_from_payroll ? 'bg-accent' : 'bg-ink/20 dark:bg-ink/30'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${form.deduct_from_payroll ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-ink font-rethink">Active</span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={form.is_active}
                                        onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-paper dark:focus:ring-offset-ink ${form.is_active ? 'bg-accent' : 'bg-ink/20 dark:bg-ink/30'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                            </div>

                            {(lastEditedBy || lastUpdated) && (
                                <p className="text-[11px] text-muted font-rethink">
                                    Last edited by <span className="text-ink font-medium">{lastEditedBy || 'Unknown'}</span>
                                    {lastUpdated ? ` · ${new Date(lastUpdated).toLocaleString()}` : ''}
                                </p>
                            )}

                            <div className="flex justify-stretch sm:justify-end">
                                <Button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="font-rethink text-xs h-9 px-4 rounded-md bg-purple-600 text-white hover:bg-purple-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
                                >
                                    <span className="flex flex-row items-center justify-center gap-1.5">
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                                                <span className="whitespace-nowrap leading-none">Saving…</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-3.5 w-3.5 shrink-0" />
                                                <span className="whitespace-nowrap leading-none">Save Settings</span>
                                            </>
                                        )}
                                    </span>
                                </Button>
                            </div>
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
};

export default NightDiffTab;