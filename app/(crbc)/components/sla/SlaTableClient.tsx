"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import type { SLARecord } from "../../types/sla";

const PAGE_SIZES = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

const slaStatusStyle: Record<string, string> = {
  "On Time": "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  Delayed:   "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  Pending:   "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
};

function getPageItems(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end   = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("…");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < totalPages - 1) items.push("…");
  items.push(totalPages);
  return items;
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted">
      <span>{label}</span>
      <select
        key={value}
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-line bg-background text-xs text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Pagination({
  page, totalPages, onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const arrowBtn =
    "p-1.5 rounded-md border border-line text-muted hover:text-foreground disabled:opacity-40 disabled:hover:text-muted transition-colors";
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page" className={arrowBtn}>
        <ChevronLeft size={14} />
      </button>
      {getPageItems(page, totalPages).map((item, i) =>
        item === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-muted">…</span>
        ) : (
          <button
            type="button"
            key={item}
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={`min-w-7 h-7 px-1.5 rounded-md text-xs font-medium transition-colors ${
              item === page ? "bg-primary text-primary-foreground" : "text-muted hover:bg-foreground/20"
            }`}
          >
            {item}
          </button>
        )
      )}
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page" className={arrowBtn}>
        <ChevronRight size={14} />
      </button>
    </nav>
  );
}

type Props = {
  rows: SLARecord[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  search: string;
  statusFilter: string;
};

export default function SlaTableClient({
  rows, page, pageSize, totalCount, totalPages, search, statusFilter,
}: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo   = Math.min(page * pageSize, totalCount);

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function setParam(key: string, value: string, defaultValue: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    push(next);
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    push(next);
  }

  function handleSearch(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value.trim()) next.set("search", value.trim());
    else next.delete("search");
    next.delete("page");
    push(next);
  }

  const hasActiveFilters = !!search || statusFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-background border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              defaultValue={search}
              key={search}
              placeholder="Search shipment, region…"
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8 pr-8 py-2 rounded-lg border border-line bg-background text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent w-56"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <FilterSelect
            label="Status:"
            value={statusFilter}
            onChange={(v) => setParam("status", v, "all")}
            options={[
              { value: "all",     label: "All Statuses" },
              { value: "On Time", label: "On Time" },
              { value: "Delayed", label: "Delayed" },
              { value: "Pending", label: "Pending" },
            ]}
          />

          {hasActiveFilters && (
            <button type="button" onClick={() => push(new URLSearchParams())} className="text-xs text-muted hover:text-foreground underline">
              Clear all
            </button>
          )}

          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            {isPending && <Loader2 size={13} className="animate-spin" />}
            <span>{totalCount} {totalCount === 1 ? "record" : "records"}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-background border border-line rounded-xl overflow-hidden">
        <div className={`overflow-x-auto transition-opacity ${isPending ? "opacity-60" : ""}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {["Shipment No.", "Region", "Expected Delivery", "Actual Delivery", "Variance", "SLA Status"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium text-xs text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">
                    No records match your filters.
                  </td>
                </tr>
              ) : rows.map((r) => (
                <tr key={r.shipmentId} className="border-b border-line last:border-0 hover:bg-line/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-accent text-xs">{r.shipmentId}</td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {r.region ?? (
                      <span className="text-zinc-500" title="Not Evaluable — destination province is missing">
                        Not Evaluable
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{r.expectedDelivery ?? "—"}</td>
                  <td className="px-4 py-3 text-muted text-xs">{r.actualDelivery ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.daysVariance === null ? (
                      <span className="text-muted">—</span>
                    ) : r.daysVariance <= 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">{Math.abs(r.daysVariance)}d early</span>
                    ) : (
                      <span className="text-red-500 dark:text-red-400">+{r.daysVariance}d late</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${slaStatusStyle[r.slaStatus] ?? ""}`}>
                      {r.slaStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 px-4 py-3 border-t border-line sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <FilterSelect
              label="Rows per page:"
              value={String(pageSize)}
              onChange={(v) => setParam("pageSize", v, String(DEFAULT_PAGE_SIZE))}
              options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            />
            <span className="text-xs text-muted">
              Showing {showingFrom}–{showingTo} of {totalCount} records
            </span>
          </div>
          <Pagination page={page} totalPages={Math.max(totalPages, 1)} onPageChange={goToPage} />
        </div>
      </div>
    </div>
  );
}
