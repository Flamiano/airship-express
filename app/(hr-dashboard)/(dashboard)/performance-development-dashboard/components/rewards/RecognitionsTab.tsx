"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { RecognitionListItem } from "@/performance-development-dashboard/types";
import { recognitionCategoryTone } from "@/performance-development-dashboard/types";

type Props = {
  recognitions: RecognitionListItem[];
  refreshing: boolean;
  onOpenCreate: () => void;
};

export function RecognitionsTab({ recognitions, refreshing, onOpenCreate }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recognitions;
    return recognitions.filter((recognition) => {
      const searchable = [
        recognition.recipientName,
        recognition.recipientNumber,
        recognition.senderName,
        recognition.senderNumber,
        recognition.message,
        recognition.badgeName,
        recognition.reason_category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [recognitions, query]);

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
            placeholder="Search recognitions..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </div>
        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
        >
          <Plus size={14} strokeWidth={2} />
          Post recognition
        </button>
      </div>

      {refreshing && (
        <p className="mt-4 text-[12px] text-muted">Refreshing...</p>
      )}

      <div className="mt-5 space-y-4">
        {!refreshing && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center dark:border-paper/15">
            <p className="text-[13.5px] font-medium text-ink">
              {recognitions.length === 0
                ? "No recognitions yet"
                : "No matches"}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              {recognitions.length === 0
                ? "Post the first recognition to get started."
                : "Try a different search term."}
            </p>
          </div>
        )}

        {filtered.map((recognition) => {
          const categoryTone =
            recognitionCategoryTone(recognition.reason_category ?? "");
          return (
            <article
              key={recognition.id}
              className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/15"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[14px] font-semibold text-accent">
                    {recognition.recipientName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-medium text-ink">
                      {recognition.recipientName}
                    </p>
                    <p className="truncate text-[11.5px] text-muted">
                      {recognition.recipientNumber} · recognized by{" "}
                      {recognition.senderName}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {recognition.badgeName && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/[0.08] px-2.5 py-1 text-[11.5px] font-medium text-accent">
                      {recognition.badgeIconUrl?.startsWith("http") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recognition.badgeIconUrl}
                          alt=""
                          className="h-3.5 w-3.5 rounded-full object-cover"
                        />
                      ) : (
                        recognition.badgeIconUrl
                      )}
                      {recognition.badgeName}
                    </span>
                  )}
                  {recognition.reason_category && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ${
                        categoryTone === "accent"
                          ? "bg-accent/[0.08] text-accent"
                          : categoryTone === "green"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : categoryTone === "amber"
                              ? "bg-amber-500/10 text-amber-600"
                              : categoryTone === "violet"
                                ? "bg-violet-500/10 text-violet-600"
                                : "bg-paper text-muted"
                      }`}
                    >
                      {recognition.reason_category}
                    </span>
                  )}
                  <span className="rounded-full bg-paper px-2.5 py-1 text-[11.5px] font-medium tabular-nums text-muted">
                    {recognition.points} pts
                  </span>
                  <span className="rounded-full bg-paper px-2.5 py-1 text-[11.5px] font-medium text-muted">
                    {recognition.visibility}
                  </span>
                </div>
              </div>

              {recognition.message && (
                <p className="mt-3 border-l-2 border-accent/40 pl-3 text-[13px] leading-relaxed text-ink/80">
                  {recognition.message}
                </p>
              )}

              <p className="mt-3 text-[11.5px] text-muted">
                {new Date(recognition.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {new Date(recognition.created_at).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}