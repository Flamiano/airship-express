'use client';

const RECENT_RUNS = [
    { id: 'PR-0812', label: 'July Cut-off 2', amount: '₱2.41M', status: 'Disbursed' },
    { id: 'PR-0798', label: 'July Cut-off 1', amount: '₱2.38M', status: 'Disbursed' },
    { id: 'PR-0781', label: 'June Cut-off 2', amount: '₱2.35M', status: 'Disbursed' },
    { id: 'PR-0764', label: 'June Cut-off 1', amount: '₱2.33M', status: 'Disbursed' },
];

export function RecentPayrollRuns() {
    return (
        <div className="w-full rounded-2xl border border-line px-5 py-5 dark:border-paper/10">
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                Recent payroll runs
            </p>
            <div className="mt-4 flex flex-col gap-3">
                {RECENT_RUNS.map((run) => (
                    <div key={run.id} className="flex items-center justify-between">
                        <div>
                            <p className="text-[13px] font-medium text-ink">{run.label}</p>
                            <p className="text-[11.5px] text-muted">{run.id}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[13px] font-medium text-ink">{run.amount}</p>
                            <span className="text-[11px] font-medium text-emerald-600">
                                {run.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}