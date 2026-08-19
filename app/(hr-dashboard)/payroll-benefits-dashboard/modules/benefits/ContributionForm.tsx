'use client';

import React, { useState, useEffect } from 'react';
import { Building2, HeartPulse, Home } from 'lucide-react';
import { Input } from '@/payroll-benefits-dashboard/components/ui/Input';
import { DatePicker } from '@/payroll-benefits-dashboard/components/ui/DatePicker';
import { Button } from '@/payroll-benefits-dashboard/components/ui/Button';

interface ContributionFormProps {
    initialData?: any;
    onSave: (data: any) => void | Promise<void>;
    onCancel: () => void;
    type: 'sss' | 'philhealth' | 'pagibig';
}

type ProgramType = ContributionFormProps['type'];

interface ProgramMeta {
    label: string;
    helper: string;
    text: string;
    bg: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
}

const TYPE_META: Record<ProgramType, ProgramMeta> = {
    sss: {
        label: 'SSS Monthly Salary Credit',
        helper: 'Sets the salary bracket, MSC, and shared contribution amounts.',
        text: 'text-sss',
        bg: 'bg-sss-soft',
        border: 'border-sss/25',
        icon: Building2,
    },
    philhealth: {
        label: 'PhilHealth Premium Rate',
        helper: 'Sets the percentage split, base salary floor, and the maximum monthly premium.',
        text: 'text-philhealth',
        bg: 'bg-philhealth-soft',
        border: 'border-philhealth/25',
        icon: HeartPulse,
    },
    pagibig: {
        label: 'Pag-IBIG Contribution Tier',
        helper: 'Sets the salary range, rate split, and share ceilings for this tier.',
        text: 'text-pagibig',
        bg: 'bg-pagibig-soft',
        border: 'border-pagibig/25',
        icon: Home,
    },
};

const toPercentDisplay = (value: any) => {
    if (value === undefined || value === null || value === '') return '';
    const percent = Number(value) * 100;
    return Number.isFinite(percent) ? Number(percent.toFixed(4)) : '';
};

const ContributionForm: React.FC<ContributionFormProps> = ({
    initialData,
    onSave,
    onCancel,
    type,
}) => {
    const [formData, setFormData] = useState<any>(initialData || {});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setFormData(initialData || {});
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type: inputType } = e.target;
        const finalValue = inputType === 'number' && value !== '' ? parseFloat(value) : value;
        setFormData((prev: any) => ({ ...prev, [name]: finalValue }));
    };

    const handlePercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({
            ...prev,
            [name]: value === '' ? '' : parseFloat(value) / 100,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(formData);
        } finally {
            setIsSaving(false);
        }
    };

    const meta = TYPE_META[type];
    const Icon = meta.icon;

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className={`flex items-start gap-3 rounded-lg border ${meta.border} ${meta.bg} px-4 py-3`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${meta.border} ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.text}`} />
                </div>
                <div className="min-w-0">
                    <p className={`text-sm font-semibold font-rethink ${meta.text}`}>{meta.label}</p>
                    <p className="text-xs text-muted mt-0.5">{meta.helper}</p>
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">
                    Effective Date
                </label>
                <DatePicker
                    name="effective_date"
                    value={formData.effective_date || ''}
                    onChange={handleChange}
                    required
                />
            </div>

            {type === 'sss' && (
                <div className="space-y-4 rounded-lg border border-line p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Min Salary</label>
                            <Input
                                name="range_min"
                                type="number"
                                step="0.01"
                                value={formData.range_min ?? ''}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Max Salary</label>
                            <Input
                                name="range_max"
                                type="number"
                                step="0.01"
                                value={formData.range_max ?? ''}
                                onChange={handleChange}
                                placeholder="Leave blank for Above"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Monthly Salary Credit (MSC)</label>
                        <Input
                            name="monthly_salary_credit"
                            type="number"
                            step="0.01"
                            value={formData.monthly_salary_credit ?? ''}
                            onChange={handleChange}
                            required
                            className="font-semibold"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Employer Share (₱)</label>
                            <Input
                                name="employer_share"
                                type="number"
                                step="0.01"
                                value={formData.employer_share ?? ''}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Employee Share (₱)</label>
                            <Input
                                name="employee_share"
                                type="number"
                                step="0.01"
                                value={formData.employee_share ?? ''}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">EC Share (Employer Comp) (₱)</label>
                        <Input
                            name="ec_share"
                            type="number"
                            step="0.01"
                            value={formData.ec_share ?? 10.0}
                            onChange={handleChange}
                        />
                    </div>
                </div>
            )}

            {type === 'philhealth' && (
                <div className="space-y-4 rounded-lg border border-line p-4">
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Base Minimum Salary (₱)</label>
                        <Input
                            name="base_min_salary"
                            type="number"
                            step="0.01"
                            value={formData.base_min_salary ?? 0}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Employer Rate (%)</label>
                            <Input
                                name="employer_rate"
                                type="number"
                                step="0.01"
                                value={toPercentDisplay(formData.employer_rate)}
                                onChange={handlePercentChange}
                                placeholder="e.g. 2.5"
                                required
                            />
                        </div>
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Employee Rate (%)</label>
                            <Input
                                name="employee_rate"
                                type="number"
                                step="0.01"
                                value={toPercentDisplay(formData.employee_rate)}
                                onChange={handlePercentChange}
                                placeholder="e.g. 2.5"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Premium Cap (Maximum) (₱)</label>
                        <Input
                            name="premium_cap"
                            type="number"
                            step="0.01"
                            value={formData.premium_cap ?? ''}
                            onChange={handleChange}
                            required
                            className="font-semibold"
                        />
                    </div>
                </div>
            )}

            {type === 'pagibig' && (
                <div className="space-y-4 rounded-lg border border-line p-4">
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Tier Name</label>
                        <Input
                            name="tier_name"
                            value={formData.tier_name ?? ''}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Salary Min (₱)</label>
                            <Input
                                name="salary_min"
                                type="number"
                                step="0.01"
                                value={formData.salary_min ?? ''}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Salary Max (₱)</label>
                            <Input
                                name="salary_max"
                                type="number"
                                step="0.01"
                                value={formData.salary_max ?? ''}
                                onChange={handleChange}
                                placeholder="Leave blank for Above"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Employer Rate (%)</label>
                            <Input
                                name="employer_rate"
                                type="number"
                                step="0.01"
                                value={toPercentDisplay(formData.employer_rate)}
                                onChange={handlePercentChange}
                                placeholder="e.g. 2"
                                required
                            />
                        </div>
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Employee Rate (%)</label>
                            <Input
                                name="employee_rate"
                                type="number"
                                step="0.01"
                                value={toPercentDisplay(formData.employee_rate)}
                                onChange={handlePercentChange}
                                placeholder="e.g. 2"
                                required
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Max Employer Share (₱)</label>
                            <Input
                                name="max_employer_share"
                                type="number"
                                step="0.01"
                                value={formData.max_employer_share ?? ''}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="min-w-0">
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1.5">Max Employee Share (₱)</label>
                            <Input
                                name="max_employee_share"
                                type="number"
                                step="0.01"
                                value={formData.max_employee_share ?? ''}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-line mt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving} className="w-full sm:w-auto">
                    Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving ? 'Saving…' : 'Save Changes'}
                </Button>
            </div>
        </form>
    );
};

export default ContributionForm;