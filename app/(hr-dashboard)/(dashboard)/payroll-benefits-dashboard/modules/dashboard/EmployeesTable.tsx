'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, Users } from 'lucide-react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

const PAGE_SIZE = 8;

type Raw = Record<string, any>;

const NAME_KEYS = [
    'employee_name',
    'employeeName',
    'emp_name',
    'name',
    'full_name',
    'fullName',
    'employee_full_name',
    'employeeFullName',
    'fullname',
];

function resolveName(e: Raw): string {
    for (const k of NAME_KEYS) {
        const v = e?.[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    const first =
        e?.first_name ?? e?.firstName ?? e?.given_name ?? e?.givenName ?? '';
    const last =
        e?.last_name ?? e?.lastName ?? e?.surname ?? e?.family_name ?? '';
    const combined = `${first} ${last}`.trim();
    return combined;
}

const initialsOf = (name: string) =>
    (name || '??')
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

const AVATAR_PALETTE = [
    'from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300',
    'from-pink-100 to-rose-100 text-pink-700 dark:from-pink-950/40 dark:to-rose-950/40 dark:text-pink-300',
    'from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-950/40 dark:to-teal-950/40 dark:text-emerald-300',
    'from-amber-100 to-orange-100 text-amber-700 dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-300',
    'from-purple-100 to-violet-100 text-purple-700 dark:from-purple-950/40 dark:to-violet-950/40 dark:text-purple-300',
    'from-cyan-100 to-sky-100 text-cyan-700 dark:from-cyan-950/40 dark:to-sky-950/40 dark:text-cyan-300',
];
const avatarClass = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

function statusChip(status: string | undefined) {
    const s = (status || 'active').toLowerCase();
    if (s === 'active')
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300';
    if (s === 'inactive')
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400';
    if (s === 'on_leave' || s === 'on leave')
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300';
    if (s === 'terminated' || s === 'resigned')
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300';
    return 'bg-ink/5 text-muted';
}

export function EmployeesTable() {
    const [employees, setEmployees] = useState<Raw[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { fetchData: fetchEmployees } = useApi(
        '/payroll-benefits-dashboard/api/payroll/employee-info'
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await fetchEmployees().catch(() => []);
                if (cancelled) return;
                const list: Raw[] = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.rows)
                        ? data.rows
                        : Array.isArray(data?.employees)
                            ? data.employees
                            : [];

                if (list.length > 0 && typeof window !== 'undefined') {
                    console.warn('[EmployeesTable] First row:', list[0]);
                    console.warn(
                        '[EmployeesTable] All keys:',
                        Object.keys(list[0]).join(', ')
                    );
                    console.warn(
                        '[EmployeesTable] Resolved name:',
                        resolveName(list[0]) || '(EMPTY — no name field found)'
                    );
                }

                setEmployees(list);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [fetchEmployees]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return employees;
        return employees.filter((e) => {
            const name = resolveName(e).toLowerCase();
            const num = String(e.employee_id_number ?? '').toLowerCase();
            const dept = String(e.department ?? '').toLowerCase();
            const title = String(e.job_title ?? '').toLowerCase();
            return (
                name.includes(term) ||
                num.includes(term) ||
                dept.includes(term) ||
                title.includes(term)
            );
        });
    }, [employees, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => {
        const start = (safePage - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, safePage]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-line border-l-4 border-l-blue-500 bg-paper dark:border-paper/10">
            <Users
                size={96}
                className="pointer-events-none absolute -bottom-4 -right-4 text-blue-500 opacity-[0.05]"
            />
            <div className="relative flex flex-col gap-3 border-b border-line px-5 py-4 dark:border-paper/10 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Users size={16} className="text-blue-500" />
                    <h3 className="text-[14px] font-medium text-ink font-rethink">Employees</h3>
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10.5px] font-medium text-muted dark:bg-ink/10">
                        {filtered.length}
                    </span>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, ID, department…"
                        className="w-full rounded-lg border border-line bg-paper pl-8 pr-3 py-1.5 text-[12.5px] font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-paper/10"
                    />
                </div>
            </div>

            {loading ? (
                <div className="relative flex items-center justify-center gap-2 py-14 text-[13px] text-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    Loading employees…
                </div>
            ) : filtered.length === 0 ? (
                <div className="relative flex flex-col items-center justify-center gap-1 py-14 text-center">
                    <Users className="h-6 w-6 text-muted/50" />
                    <p className="text-[13px] font-medium text-ink font-rethink">No employees found</p>
                    <p className="text-[11.5px] text-muted">
                        {search ? 'Try a different search.' : 'Add employees to see them here.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="relative hidden md:block overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee ID</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Position</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Department</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Date hired</th>
                                    <th className="text-center px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((e, idx) => {
                                    const key = e.employee_id ?? e.id ?? String(idx);
                                    const name = resolveName(e) || '—';
                                    const title = e.job_title ?? '—';
                                    const dept = e.department ?? '—';
                                    const status = e.status ?? (e.is_active === false ? 'inactive' : 'active');
                                    return (
                                        <tr
                                            key={key}
                                            className="border-b border-line last:border-b-0 transition-colors hover:bg-accent/[0.03] dark:border-paper/10"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div
                                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(
                                                            name
                                                        )}`}
                                                    >
                                                        {initialsOf(name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-medium text-ink font-rethink truncate">
                                                            {name}
                                                        </p>
                                                        {e.email && (
                                                            <p className="text-[10.5px] text-muted truncate">{e.email}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[12px] font-mono text-ink whitespace-nowrap">
                                                {e.employee_id_number ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-[12.5px] text-ink font-rethink truncate max-w-[180px]">
                                                {title}
                                            </td>
                                            <td className="px-4 py-3 text-[12.5px] text-muted font-rethink truncate max-w-[160px]">
                                                {dept}
                                            </td>
                                            <td className="px-4 py-3 text-[12px] text-muted whitespace-nowrap">
                                                {e.date_hired
                                                    ? new Date(e.date_hired + 'T00:00:00').toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: '2-digit',
                                                        year: 'numeric',
                                                    })
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium font-rethink capitalize ${statusChip(
                                                        String(status)
                                                    )}`}
                                                >
                                                    {String(status).replace('_', ' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="relative md:hidden divide-y divide-line dark:divide-paper/10">
                        {paginated.map((e, idx) => {
                            const key = e.employee_id ?? e.id ?? String(idx);
                            const name = resolveName(e) || '—';
                            const title = e.job_title ?? '—';
                            const status = e.status ?? (e.is_active === false ? 'inactive' : 'active');
                            return (
                                <div key={key} className="px-4 py-3.5">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(
                                                name
                                            )}`}
                                        >
                                            {initialsOf(name)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13.5px] font-medium text-ink font-rethink truncate">
                                                {name}
                                            </p>
                                            <p className="text-[11px] text-muted truncate">{title}</p>
                                            <p className="text-[10.5px] text-muted mt-0.5 font-mono">
                                                {e.employee_id_number ?? '—'}
                                            </p>
                                        </div>
                                        <span
                                            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium font-rethink capitalize ${statusChip(
                                                String(status)
                                            )}`}
                                        >
                                            {String(status).replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="relative flex items-center justify-between border-t border-line px-4 py-3 dark:border-paper/10">
                        <p className="text-[11.5px] text-muted font-rethink">
                            Page {safePage} of {totalPages} ·{' '}
                            {Math.min(filtered.length, (safePage - 1) * PAGE_SIZE + 1)}–
                            {Math.min(filtered.length, safePage * PAGE_SIZE)} of {filtered.length}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted transition-colors hover:bg-accent/[0.06] hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed dark:border-paper/10"
                                aria-label="Previous page"
                            >
                                <ChevronLeft size={13} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted transition-colors hover:bg-accent/[0.06] hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed dark:border-paper/10"
                                aria-label="Next page"
                            >
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default EmployeesTable;