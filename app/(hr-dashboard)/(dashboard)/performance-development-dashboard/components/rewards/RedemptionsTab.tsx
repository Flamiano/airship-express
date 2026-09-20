"use client";

import { useMemo, useState } from "react";
import { Gift, Plus, Search } from "lucide-react";
import type { RedemptionListItem } from "@/performance-development-dashboard/types";
import { redemptionStatusTone } from "@/performance-development-dashboard/types";

type Props = {
  redemptions: RedemptionListItem[];
  refreshing: boolean;
  onOpenCreate: () => void;
  onOpenProcess: (redemption: RedemptionListItem) => void;
};

export function RedemptionsTab({
  redemptions,
  refreshing,
  onOpenCreate,
  onOpenProcess,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return redemptions;
    return redemptions.filter((redemption) => {
      const searchable = [
        redemption.employeeName,
        redemption.employeeNumber,
        redemption.reward_description,
        redemption.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [redemptions, query]);

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
            placeholder="Search redemptions..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </div>
        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
        >
          <Plus size={14} strokeWidth={2} />
          Log redemption
        </button>
      </div>

      {refreshing && (
        <p className="mt-4 text-[12px] text-muted">Refreshing...</p>
      )}

      <div className="mt-5 space-y-4">
        {!refreshing && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center dark:border-paper/15">
            <p className="text-[13.5px] font-medium text-ink">
              {redemptions.length === 0
                ? "No redemptions yet"
                : "No matching redemptions"}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              {redemptions.length === 0
                ? "Log the first redemption to get started."
                : "Try a different search term."}
            </p>
          </div>
        )}

        {filtered.map((redemption) => {
          const statusTone = redemptionStatusTone(redemption.status);
          return (
            <article
              key={redemption.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-paper p-5 dark:border-paper/15"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Gift size={16} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-medium text-ink">
                    {redemption.employeeName}{" "}
                    <span className="font-normal text-muted">·</span>{" "}
                    <span className="tabular-nums text-accent">
                      {redemption.points_used} pts
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink/80">
                    {redemption.reward_description}
                  </p>
                  <p className="mt-2 text-[11.5px] text-muted">
                    {redemption.employeeNumber} · requested{" "}
                    {new Date(redemption.requested_at).toLocaleDateString(
                      undefined,
                      { year: "numeric", month: "short", day: "numeric" }
                    )}
                    {redemption.processed_at
                      ? ` · processed ${new Date(
                          redemption.processed_at
                        ).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ${
                    statusTone === "green"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : statusTone === "amber"
                        ? "bg-amber-500/10 text-amber-600"
                        : statusTone === "red"
                          ? "bg-red-500/10 text-red-600"
                          : statusTone === "accent"
                            ? "bg-accent/10 text-accent"
                            : "bg-paper text-muted"
                  }`}
                >
                  {redemption.status}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenProcess(redemption)}
                  className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
                >
                  Update
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}