"use client";

import { useMemo, useState } from "react";
import { Award, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { BadgeListItem } from "@/performance-development-dashboard/types";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";

type Props = {
  badges: BadgeListItem[];
  refreshing: boolean;
  busy: boolean;
  onOpenCreate: () => void;
  onOpenEdit: (badge: BadgeListItem) => void;
  onDelete: (badge: BadgeListItem) => Promise<void>;
};

export function BadgesTab({
  badges,
  refreshing,
  busy,
  onOpenCreate,
  onOpenEdit,
  onDelete,
}: Props) {
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return badges;
    return badges.filter((badge) =>
      [badge.name, badge.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [badges, query]);

  async function handleDelete(badge: BadgeListItem) {
    await onDelete(badge);
    setConfirmId(null);
  }

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
            placeholder="Search badges..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </div>
        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
        >
          <Plus size={14} strokeWidth={2} />
          Add badge
        </button>
      </div>

      {refreshing && (
        <p className="mt-4 text-[12px] text-muted">Refreshing...</p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!refreshing && filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-line p-10 text-center dark:border-paper/15">
            <p className="text-[13.5px] font-medium text-ink">
              {badges.length === 0 ? "No badges yet" : "No matching badges"}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              {badges.length === 0
                ? "Badges are attached to recognitions to recognize a moment."
                : "Try a different search term."}
            </p>
          </div>
        )}

        {filtered.map((badge) => (
          <div
            key={badge.id}
            className="group flex flex-col rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-accent/40 dark:border-paper/15"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent/10 text-[18px] text-accent">
                {badge.icon_url?.startsWith("http") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={badge.icon_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  badge.icon_url || <Award size={18} strokeWidth={1.75} />
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {!busy && (
                  <>
                    <Tooltip label="Edit badge">
                      <button
                        type="button"
                        onClick={() => onOpenEdit(badge)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
                        aria-label="Edit badge"
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                    </Tooltip>
                    {confirmId === badge.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDelete(badge)}
                          disabled={busy}
                          className="rounded-md bg-red-500/10 px-2 py-1 text-[11.5px] font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          disabled={busy}
                          className="rounded-md px-2 py-1 text-[11.5px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <Tooltip label="Delete badge (blocked if used by recognitions)">
                      <button
                        type="button"
                        onClick={() => setConfirmId(badge.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-red-500/10 hover:text-red-600"
                        aria-label="Delete badge"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </Tooltip>
                    )}
                  </>
                )}
              </div>
            </div>

            <p className="mt-3 text-[14.5px] font-medium text-ink">
              {badge.name}
            </p>
            {badge.description && (
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                {badge.description}
              </p>
            )}
            <p className="mt-auto pt-3 text-[11.5px] tabular-nums text-muted">
              Used in {badge.usageCount} recognition
              {badge.usageCount === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}