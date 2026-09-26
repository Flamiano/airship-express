'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Lock, Loader2, ShieldCheck, AlertCircle, Printer } from 'lucide-react';

const peso = (n: number | null | undefined) =>
    `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value: string | null | undefined) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('en-PH', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return value;
    }
};

const formatPeriod = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start || !end) return '—';
    const s = new Date(start);
    const e = new Date(end);
    const month = s.toLocaleDateString('en-PH', { month: 'long' }).toUpperCase();
    return `${month} ${s.getDate()} - ${e.getDate()}, ${e.getFullYear()}`;
};

export default function EmployeePayslipPortal() {
    const params = useParams();
    const payslipId = Number(params?.id);

    const [password, setPassword] = useState('');
    const [unlocked, setUnlocked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);

    const handleVerify = async () => {
        if (!/^\d{6}$/.test(password)) {
            setError('Password must be 6 digits (MMDDYY).');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/payroll-benefits-dashboard/api/employee-portal/payslip/${payslipId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Unable to verify.');
            setData(json.payslip);
            setUnlocked(true);
        } catch (err: any) {
            setError(err?.message || 'Unable to verify.');
        } finally {
            setLoading(false);
        }
    };

    if (!unlocked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-8 shadow-lg">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent mx-auto mb-4">
                        <Lock className="h-7 w-7" />
                    </div>
                    <h1 className="text-lg font-semibold text-ink text-center font-bricolage">Payslip Access</h1>
                    <p className="text-xs text-muted text-center font-rethink mt-1">
                        Enter your 6-digit password to view your payslip
                    </p>
                    <div className="mt-6 space-y-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Password</label>
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value.replace(/\D/g, ''));
                                    setError(null);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                                placeholder="MMDDYY"
                                autoFocus
                                className="w-full rounded-lg border border-line bg-paper px-3 py-3 text-center text-lg font-mono tracking-[0.5em] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                            />
                            <p className="mt-1.5 text-[11px] text-muted font-rethink text-center">
                                Default: your birthdate in MMDDYY format (e.g. April 08, 2005 → 040805)
                            </p>
                        </div>
                        {error && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800/30 dark:bg-red-950/30">
                                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                                <p className="text-xs text-red-700 dark:text-red-300 font-rethink">{error}</p>
                            </div>
                        )}
                        <button
                            onClick={handleVerify}
                            disabled={loading || password.length !== 6}
                            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors font-rethink"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                                    Verifying…
                                </>
                            ) : (
                                'Unlock Payslip'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const earnings = [
        { label: 'Total Pay', value: data.earnings.totalPay },
        { label: 'Days Worked', value: data.earnings.daysWorked, isCount: true },
        { label: 'Overtime', value: data.earnings.overtime },
        { label: 'Regular Holiday', value: data.earnings.regularHoliday },
        { label: 'Special Holiday', value: data.earnings.specialHoliday },
        { label: 'Incentives', value: data.earnings.incentives },
    ];

    const allowances = [
        { label: 'Load', value: data.earnings.load },
        { label: 'Transpo', value: data.earnings.transpo },
        { label: 'Miscellaneous', value: data.earnings.miscellaneous },
        { label: 'Gas', value: data.earnings.gas },
        { label: 'Adjustment', value: data.earnings.adjustment },
    ];

    const deductions = [
        { label: 'SSS', value: data.deductions.sss },
        { label: 'Pag-IBIG', value: data.deductions.pagibig },
        { label: 'PhilHealth', value: data.deductions.philhealth },
    ];

    const loans = [
        { label: 'SSS Loan', value: data.deductions.sssLoan },
        { label: 'Pag-IBIG Loan', value: data.deductions.pagibigLoan },
        { label: 'Cash Advance Balance', value: data.deductions.cashAdvanceBalance },
    ];

    const otherDeductions = [
        { label: 'Tardiness', value: data.deductions.tardiness },
        { label: 'Penalty Deduction', value: data.deductions.penalty },
        { label: "Employee's Savings", value: data.deductions.employeeSavings },
        { label: 'Excess', value: data.deductions.excess },
    ];

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-4 print:hidden">
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-rethink">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Verified Access</span>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print / Save PDF
                    </button>
                </div>

                <div className="rounded-2xl border-2 border-purple-900 bg-white shadow-lg overflow-hidden">
                    <div className="p-5 border-b-2 border-purple-900">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent text-white font-bold text-lg">
                                AE
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-ink font-bricolage">
                                    R.E.T AIRSHIP COURIER SERVICES
                                </h1>
                                <p className="text-[11px] text-muted font-rethink">
                                    352 Escolta St., Tomas Pinpin, Binondo, Manila.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-pink-200 px-6 py-2.5 text-center border-b-2 border-purple-900">
                        <h2 className="text-sm font-bold text-purple-900 font-bricolage italic">
                            PAYSLIP FOR THE MONTH OF {formatPeriod(data.period_start, data.period_end)}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 border-b-2 border-purple-900">
                        <div className="border-r-2 border-purple-900">
                            <table className="w-full border-collapse text-xs">
                                <tbody>
                                    <tr className="border-b border-purple-900">
                                        <td className="bg-pink-100 px-3 py-2 font-semibold uppercase text-purple-900 w-[38%]">
                                            Email Address
                                        </td>
                                        <td className="px-3 py-2 text-ink">{data.email}</td>
                                    </tr>
                                    <tr className="border-b border-purple-900">
                                        <td className="bg-pink-100 px-3 py-2 font-semibold uppercase text-purple-900">
                                            Name
                                        </td>
                                        <td className="px-3 py-2 text-ink">{data.employee_name}</td>
                                    </tr>
                                    <tr className="border-b border-purple-900">
                                        <td className="bg-pink-100 px-3 py-2 font-semibold uppercase text-purple-900">
                                            Position
                                        </td>
                                        <td className="px-3 py-2 text-ink">{data.position || '—'}</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-pink-100 px-3 py-2 font-semibold uppercase text-purple-900">
                                            Employee ID
                                        </td>
                                        <td className="px-3 py-2 text-ink font-mono">{data.employee_id_number}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table className="w-full border-collapse text-xs">
                                <tbody>
                                    <tr className="border-b border-purple-900">
                                        <td className="bg-pink-100 px-3 py-2 font-semibold uppercase text-purple-900 w-[45%]">
                                            Month of {new Date(data.period_start).toLocaleDateString('en-PH', { month: 'long' }).toUpperCase()}
                                        </td>
                                        <td className="px-3 py-2"></td>
                                    </tr>
                                    <tr className="border-b border-purple-900">
                                        <td className="bg-pink-100 px-3 py-2 font-semibold uppercase text-purple-900">
                                            Cut Off Period
                                        </td>
                                        <td className="px-3 py-2 text-ink">
                                            {formatDate(data.period_start)} - {formatDate(data.period_end)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="bg-pink-100 px-3 py-2 font-semibold uppercase text-purple-900">
                                            Daily Rate
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-ink">
                                            {data.daily_rate > 0 ? peso(data.daily_rate) : '—'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="border-r-2 border-purple-900">
                            <div className="bg-pink-200 text-center py-1.5 text-xs font-bold uppercase text-purple-900 border-b border-purple-900">
                                Earnings
                            </div>
                            <table className="w-full border-collapse text-xs">
                                <tbody>
                                    {earnings.map((row) => (
                                        <tr key={row.label} className="border-b border-purple-900">
                                            <td className="bg-pink-50 px-3 py-2 font-semibold uppercase text-purple-900 w-[60%]">
                                                {row.label}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-ink">
                                                {row.isCount ? row.value : peso(row.value)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="bg-pink-200 text-center py-1.5 text-xs font-bold uppercase text-purple-900 border-b border-t-2 border-purple-900">
                                Allowances
                            </div>
                            <table className="w-full border-collapse text-xs">
                                <tbody>
                                    {allowances.map((row) => (
                                        <tr key={row.label} className="border-b border-purple-900 last:border-b-0">
                                            <td className="bg-pink-50 px-3 py-2 font-semibold uppercase text-purple-900 w-[60%]">
                                                {row.label}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-ink">{peso(row.value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div>
                            <div className="bg-pink-200 text-center py-1.5 text-xs font-bold uppercase text-purple-900 border-b border-purple-900">
                                Deduction
                            </div>
                            <table className="w-full border-collapse text-xs">
                                <tbody>
                                    {deductions.map((row) => (
                                        <tr key={row.label} className="border-b border-purple-900">
                                            <td className="bg-pink-50 px-3 py-2 font-semibold uppercase text-purple-900 w-[60%]">
                                                {row.label}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-ink">{peso(row.value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="bg-pink-200 text-center py-1.5 text-xs font-bold uppercase text-purple-900 border-b border-t-2 border-purple-900">
                                Loans
                            </div>
                            <table className="w-full border-collapse text-xs">
                                <tbody>
                                    {loans.map((row) => (
                                        <tr key={row.label} className="border-b border-purple-900">
                                            <td className="bg-pink-50 px-3 py-2 font-semibold uppercase text-purple-900 w-[60%]">
                                                {row.label}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-ink">{peso(row.value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="bg-pink-200 text-center py-1.5 text-xs font-bold uppercase text-purple-900 border-b border-t-2 border-purple-900">
                                Other Deduction
                            </div>
                            <table className="w-full border-collapse text-xs">
                                <tbody>
                                    {otherDeductions.map((row) => (
                                        <tr key={row.label} className="border-b border-purple-900 last:border-b-0">
                                            <td className="bg-pink-50 px-3 py-2 font-semibold uppercase text-purple-900 w-[60%]">
                                                {row.label}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-ink">{peso(row.value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 border-t-2 border-purple-900">
                        <div className="bg-pink-200 border-r-2 border-purple-900 flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-bold uppercase text-purple-900 font-rethink">Gross Total</span>
                            <span className="text-sm font-mono font-bold text-purple-900">
                                {peso(data.grossTotal)}
                            </span>
                        </div>
                        <div className="bg-pink-200 flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-bold uppercase text-purple-900 font-rethink">
                                Total Deduction
                            </span>
                            <span className="text-sm font-mono font-bold text-purple-900">
                                {peso(data.totalDeduction)}
                            </span>
                        </div>
                    </div>

                    <div className="bg-pink-200 text-center py-2 text-sm font-bold uppercase text-purple-900 border-t-2 border-purple-900 tracking-widest">
                        Net Pay
                    </div>
                    <div className="bg-white text-center py-4 border-t border-purple-900">
                        <p className="text-3xl font-mono font-bold text-emerald-700">₱ {peso(data.netPay)}</p>
                    </div>

                    <div className="text-center py-2 text-[10px] text-muted font-rethink border-t border-purple-900">
                        Generated by R.E.T Airship Courier Services payroll system.
                    </div>
                </div>
            </div>
        </div>
    );
}