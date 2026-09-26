'use client';

import React, { useState, useEffect } from 'react';
import { Building2, HeartPulse, Home } from 'lucide-react';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { DatePicker } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/DatePicker';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';

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
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className={`flex items-start gap-3 rounded-lg border ${meta.border} ${meta.bg} px-4 py-3 transition-colors duration-300`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${meta.border} ${meta.bg} transition-colors duration-300`}>
                    <Icon className={`h-4 w-4 ${meta.text}`} />
                </div>
                <div>
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
                <div className="space-y-3 rounded-lg border border-line p-4 transition-colors duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Min Salary</label>
                            <Input
                                name="range_min"
                                type="number"
                                step="0.01"
                                value={formData.range_min ?? ''}
                                onChange={handleChange}
                                required
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Max Salary</label>
                            <Input
                                name="range_max"
                                type="number"
                                step="0.01"
                                value={formData.range_max ?? ''}
                                onChange={handleChange}
                                placeholder="Leave blank for Above"
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Monthly Salary Credit (MSC)</label>
                        <Input
                            name="monthly_salary_credit"
                            type="number"
                            step="0.01"
                            value={formData.monthly_salary_credit ?? ''}
                            onChange={handleChange}
                            required
                            className="bg-background text-ink border-line focus:border-accent font-semibold"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Employer Share (₱)</label>
                            <Input
                                name="employer_share"
                                type="number"
                                step="0.01"
                                value={formData.employer_share ?? ''}
                                onChange={handleChange}
                                required
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Employee Share (₱)</label>
                            <Input
                                name="employee_share"
                                type="number"
                                step="0.01"
                                value={formData.employee_share ?? ''}
                                onChange={handleChange}
                                required
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">EC Share (Employer Comp) (₱)</label>
                        <Input
                            name="ec_share"
                            type="number"
                            step="0.01"
                            value={formData.ec_share ?? 10.0}
                            onChange={handleChange}
                            className="bg-background text-ink border-line focus:border-accent"
                        />
                    </div>
                </div>
            )}

            {type === 'philhealth' && (
                <div className="space-y-3 rounded-lg border border-line p-4 transition-colors duration-300">
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Base Minimum Salary (₱)</label>
                        <Input
                            name="base_min_salary"
                            type="number"
                            step="0.01"
                            value={formData.base_min_salary ?? 0}
                            onChange={handleChange}
                            className="bg-background text-ink border-line focus:border-accent"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Employer Rate (%)</label>
                            <Input
                                name="employer_rate"
                                type="number"
                                step="0.01"
                                value={toPercentDisplay(formData.employer_rate)}
                                onChange={handlePercentChange}
                                placeholder="e.g. 2.5"
                                required
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Employee Rate (%)</label>
                            <Input
                                name="employee_rate"
                                type="number"
                                step="0.01"
                                value={toPercentDisplay(formData.employee_rate)}
                                onChange={handlePercentChange}
                                placeholder="e.g. 2.5"
                                required
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Premium Cap (Maximum) (₱)</label>
                        <Input
                            name="premium_cap"
                            type="number"
                            step="0.01"
                            value={formData.premium_cap ?? ''}
                            onChange={handleChange}
                            required
                            className="bg-background text-ink border-line focus:border-accent font-semibold"
                        />
                    </div>
                </div>
            )}

            {type === 'pagibig' && (
                <div className="space-y-3 rounded-lg border border-line p-4 transition-colors duration-300">
                    <div>
                        <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Tier Name</label>
                        <Input
                            name="tier_name"
                            value={formData.tier_name ?? ''}
                            onChange={handleChange}
                            required
                            className="bg-background text-ink border-line focus:border-accent"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Salary Min (₱)</label>
                            <Input
                                name="salary_min"
                                type="number"
                                step="0.01"
                                value={formData.salary_min ?? ''}
                                onChange={handleChange}
                                required
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Salary Max (₱)</label>
                            <Input
                                name="salary_max"
                                type="number"
                                step="0.01"
                                value={formData.salary_max ?? ''}
                                onChange={handleChange}
                                placeholder="Leave blank for Above"
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Employer Rate (%)</label>
                            <Input
                                name="employer_rate"
                                type="number"
                                step="0.01"
                                value={toPercentDisplay(formData.employer_rate)}
                                onChange={handlePercentChange}
                                placeholder="e.g. 2"
                                required
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Employee Rate (%)</label>
                            <Input
                                name="employee_rate"
                                type="number"
                                step="0.01"
                                value={toPercentDisplay(formData.employee_rate)}
                                onChange={handlePercentChange}
                                placeholder="e.g. 2"
                                required
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Max Employer Share (₱)</label>
                            <Input
                                name="max_employer_share"
                                type="number"
                                step="0.01"
                                value={formData.max_employer_share ?? ''}
                                onChange={handleChange}
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold tracking-wide uppercase text-muted mb-1">Max Employee Share (₱)</label>
                            <Input
                                name="max_employee_share"
                                type="number"
                                step="0.01"
                                value={formData.max_employee_share ?? ''}
                                onChange={handleChange}
                                className="bg-background text-ink border-line focus:border-accent"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-line transition-colors duration-300">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving} className="w-full sm:w-auto">
                    Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </form>
    );
};

export default ContributionForm;