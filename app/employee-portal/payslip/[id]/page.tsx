'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Lock, Loader2, ShieldCheck, AlertCircle, Printer } from 'lucide-react';

const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const formatDate = (value: string | null) => {
    if (!value) return '—';
    try { return new Date(value).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return value; }
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
        if (!/^\d{6}$/.test(password)) { setError('Password must be 6 digits (MMDDYY).'); return; }
        setLoading(true); setError(null);
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
        } catch (err: any) { setError(err?.message || 'Unable to verify.'); }
        finally { setLoading(false); }
    };

    if (!unlocked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-8 shadow-lg">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent mx-auto mb-4">
                        <Lock className="h-7 w-7" />
                    </div>
                    <h1 className="text-lg font-semibold text-ink text-center font-bricolage">Payslip Access</h1>
                    <p className="text-xs text-muted text-center font-rethink mt-1">Enter your 6-digit password to view your payslip</p>
                    <div className="mt-6 space-y-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Password</label>
                            <input type="password" inputMode="numeric" maxLength={6} value={password}
                                onChange={(e) => { setPassword(e.target.value.replace(/\D/g, '')); setError(null); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                                placeholder="MMDDYY" autoFocus
                                className="w-full rounded-lg border border-line bg-paper px-3 py-3 text-center text-lg font-mono tracking-[0.5em] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
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
                        <button onClick={handleVerify} disabled={loading || password.length !== 6}
                            title="Unlock payslip"
                            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors font-rethink">
                            {loading ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Verifying…</> : 'Unlock Payslip'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const earnings = [
        { label: 'Basic Pay', value: data.basic_pay },
        { label: 'Night Differential', value: data.night_diff_pay },
        { label: 'Holiday Pay', value: data.holiday_pay },
        { label: 'Allowances', value: data.allowances_pay },
        { label: 'Bonus', value: data.bonus_pay },
        { label: 'Incentives', value: data.incentive_pay },
    ].filter((r) => r.value > 0);

    const deductions = [
        { label: 'SSS', value: data.sss_employee_share },
        { label: 'PhilHealth', value: data.philhealth_employee_share },
        { label: 'Pag-IBIG', value: data.pagibig_employee_share },
        { label: 'Withholding Tax', value: data.withholding_tax },
        { label: 'Other Deductions', value: data.other_deductions },
    ];

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-rethink">
                        <ShieldCheck className="h-4 w-4" /><span>Verified Access</span>
                    </div>
                    <button onClick={() => window.print()} title="Print this payslip"
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5">
                        <Printer className="h-3.5 w-3.5" /> Print / Save PDF
                    </button>
                </div>

                <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-line">
                        <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent text-white font-bold text-lg">AE</div>
                            <div>
                                <h1 className="text-lg font-bold text-ink font-bricolage">R.E.T AIRSHIP COURIER SERVICES</h1>
                                <p className="text-[11px] text-muted font-rethink">352 Escolta St., Tomas Pinpin, Binondo, Manila</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-pink-100 px-6 py-3 text-center">
                        <h2 className="text-base font-bold text-ink font-bricolage">
                            PAYSLIP FOR THE PERIOD {formatDate(data.period_start).toUpperCase()} – {formatDate(data.period_end).toUpperCase()}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 border-b border-line">
                        <div className="p-4 space-y-2 border-r border-line">
                            <Row label="EMAIL ADDRESS" value={data.email} />
                            <Row label="NAME" value={data.employee_name} />
                            <Row label="POSITION" value={data.position || '—'} />
                            <Row label="EMPLOYEE ID" value={data.employee_id_number} />
                        </div>
                        <div className="p-4 space-y-2">
                            <Row label="CUT OFF PERIOD" value={`${formatDate(data.period_start)} – ${formatDate(data.period_end)}`} />
                            <Row label="DAILY RATE" value={data.daily_rate > 0 ? peso(data.daily_rate) : '—'} />
                            <Row label="DAYS WORKED" value={String(data.days_worked)} />
                            <Row label="HOURS WORKED" value={String(data.hours_worked)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="border-r border-line">
                            <div className="bg-pink-100 px-4 py-2 text-center">
                                <p className="text-xs font-bold text-ink font-rethink">EARNINGS</p>
                            </div>
                            <div className="p-4 space-y-2">
                                {earnings.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between text-xs">
                                        <span className="text-muted font-rethink uppercase tracking-wide">{row.label}</span>
                                        <span className="font-mono tabular-nums text-ink">{peso(row.value)}</span>
                                    </div>
                                ))}
                                <div className="pt-3 mt-3 border-t border-line flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase font-rethink text-ink">Gross Total</span>
                                    <span className="text-sm font-mono font-bold text-ink">{peso(data.gross_pay)}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="bg-pink-100 px-4 py-2 text-center">
                                <p className="text-xs font-bold text-ink font-rethink">DEDUCTIONS</p>
                            </div>
                            <div className="p-4 space-y-2">
                                {deductions.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between text-xs">
                                        <span className="text-muted font-rethink uppercase tracking-wide">{row.label}</span>
                                        <span className="font-mono tabular-nums text-ink">{peso(row.value)}</span>
                                    </div>
                                ))}
                                <div className="pt-3 mt-3 border-t border-line flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase font-rethink text-ink">Total Deductions</span>
                                    <span className="text-sm font-mono font-bold text-red-600">{peso(data.total_deductions)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-emerald-50 border-t-2 border-emerald-300 px-6 py-4 flex items-center justify-between">
                        <span className="text-sm font-bold uppercase font-rethink text-emerald-800">NET PAY</span>
                        <span className="text-2xl font-mono font-bold text-emerald-700">{peso(data.net_pay)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-3 text-xs">
            <span className="text-muted font-rethink uppercase tracking-wide whitespace-nowrap">{label}</span>
            <span className="text-ink font-rethink text-right">{value}</span>
        </div>
    );
}