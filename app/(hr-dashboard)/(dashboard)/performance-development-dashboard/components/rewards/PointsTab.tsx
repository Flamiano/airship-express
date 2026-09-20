"use client";

import { useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal, Wallet } from "lucide-react";
import type { EmployeeOption, EmployeePointsListItem } from "@/performance-development-dashboard/types";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";

type Props = {
  points: EmployeePointsListItem[];
  employees: EmployeeOption[];
  refreshing: boolean;
  onOpenModal: (points: EmployeePointsListItem | null) => void;
};

export function PointsTab({ points, employees, refreshing, onOpenModal }: Props) {
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => [...points].sort((a, b) => b.total_points - a.total_points),
    [points]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.employeeName, row.employeeNumber, row.employeeDepartment]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const withoutBalance = useMemo(
    () =>
      employees.filter(
        (employee) => !points.some((row) => row.employee_id === employee.id)
      ),
    [employees, points]
  );

  const totalAwarded = useMemo(
    () => rows.reduce((sum, row) => sum + row.total_points, 0),
    [rows]
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={14}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </div>
        <button
          type="button"
          onClick={() => onOpenModal(null)}
          disabled={withoutBalance.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={2} />
          Add balance
        </button>
      </div>

      {refreshing && (
        <p className="mt-4 text-[12px] text-muted">Refreshing...</p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!refreshing && filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-line p-10 text-center dark:border-paper/15">
            <p className="text-[13.5px] font-medium text-ink">
              {rows.length === 0 ? "No point balances yet" : "No matching point balances"}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              {rows.length === 0
                ? "Set the first balance to begin tracking points."
                : "Try a different search term."}
            </p>
          </div>
        )}

        {filtered.map((row) => (
          <div
            key={row.id}
            className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-accent/40 dark:border-paper/15"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Wallet size={16} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-ink">
                  {row.employeeName}
                </p>
                <p className="truncate text-[11.5px] text-muted">
                  {row.employeeNumber}
                  {row.employeeDepartment
                    ? ` · ${row.employeeDepartment}`
                    : ""}
                  {row.employeeStatus ? ` · ${row.employeeStatus}` : ""}
                </p>
                {row.updated_at && (
                  <p className="mt-1 text-[11px] text-muted">
                    Updated{" "}
                    {new Date(row.updated_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-accent/10 px-3 py-1 text-[13px] font-semibold tabular-nums text-accent">
                {row.total_points}
              </span>
              <Tooltip label="Set or adjust points">
                <button
                  type="button"
                  onClick={() => onOpenModal(row)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
                  aria-label="Set or adjust points"
                >
                  <SlidersHorizontal size={14} strokeWidth={1.75} />
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 dark:border-paper/15">
        <p className="text-[12px] text-muted">
          <span className="font-semibold tabular-nums text-ink">
            {points.length}
          </span>{" "}
          tracked balances
        </p>
        <p className="text-[12px] text-muted">
          <span className="font-semibold tabular-nums text-ink">
            {totalAwarded}
          </span>{" "}
          total points on record
        </p>
        <p className="text-[12px] text-muted">
          <span className="font-semibold tabular-nums text-ink">
            {employees.length - points.length}
          </span>{" "}
          employees without a balance
        </p>
      </div>
    </div>
  );
}