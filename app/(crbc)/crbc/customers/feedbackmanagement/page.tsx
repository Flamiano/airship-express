"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Star, BarChart2, Filter, RefreshCw, Loader2, MessageSquare, TrendingUp,
} from "lucide-react";
import { getAllFeedback } from "../../../actions/feedback";
import type { Feedback } from "../../../types/feedback";

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={n <= rating ? "fill-amber-400 text-amber-400" : "text-foreground/15"}
        />
      ))}
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const colors: Record<number, string> = {
    1: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    2: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
    3: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    4: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    5: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  };
  const labels: Record<number, string> = {
    1: "Poor", 2: "Fair", 3: "Good", 4: "Very Good", 5: "Excellent",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[rating]}`}>
      <Star size={9} className="fill-current" />
      {rating} · {labels[rating]}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-background px-4 py-3.5">
      <p className="text-[11px] text-muted uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground font-bricolage">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const inputCls =
  "px-3 py-1.5 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50 placeholder:text-foreground/30";
const selectCls =
  "px-3 py-1.5 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50";

export default function FeedbackManagementPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [ratingFilter, setRatingFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function load() {
    startTransition(async () => {
      setLoading(true);
      const result = await getAllFeedback({
        rating: ratingFilter !== "all" ? ratingFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setFeedback(result.feedback);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  function handleApply() { load(); }

  function handleReset() {
    setRatingFilter("all");
    setDateFrom("");
    setDateTo("");
    startTransition(async () => {
      setLoading(true);
      const result = await getAllFeedback();
      setFeedback(result.feedback);
      setLoading(false);
    });
  }

  const total = feedback.length;
  const avgRating = total > 0
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / total).toFixed(1)
    : "—";
  const fiveStars = feedback.filter((f) => f.rating === 5).length;
  const lowRatings = feedback.filter((f) => f.rating <= 2).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bricolage text-xl font-semibold text-foreground sm:text-2xl">
            Feedback Management
          </h1>
          <p className="mt-1 text-sm text-muted">
            Customer ratings and comments for completed deliveries
          </p>
        </div>
        <button
          onClick={load}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground bg-background border border-line rounded-lg hover:bg-line/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={isPending ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Feedback" value={total} sub="all time" />
        <StatCard
          label="Average Rating"
          value={avgRating !== "—" ? `${avgRating} / 5` : "—"}
          sub={total > 0 ? `from ${total} review${total !== 1 ? "s" : ""}` : "no reviews yet"}
        />
        <StatCard label="5-Star Reviews" value={fiveStars} sub={total > 0 ? `${Math.round((fiveStars / total) * 100)}% of total` : ""} />
        <StatCard label="Low Ratings (≤2)" value={lowRatings} sub="need attention" />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-line bg-background px-4 py-3.5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted mr-1">
            <Filter size={13} /> Filters
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted">Rating</label>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">All ratings</option>
              <option value="5">5 — Excellent</option>
              <option value="4">4 — Very Good</option>
              <option value="3">3 — Good</option>
              <option value="2">2 — Fair</option>
              <option value="1">1 — Poor</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            onClick={handleApply}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            Apply
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground bg-background border border-line rounded-lg hover:bg-line/50 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-line bg-background overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-sm font-medium text-foreground">Submitted Feedback</h2>
            <p className="mt-0.5 text-xs text-muted">{total} result{total !== 1 ? "s" : ""}</p>
          </div>
          <BarChart2 size={15} className="text-muted" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading feedback…</span>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={20} className="text-muted mb-3" />
            <p className="text-sm font-medium text-foreground">No feedback found</p>
            <p className="mt-1 text-xs text-muted">
              {ratingFilter !== "all" || dateFrom || dateTo
                ? "Try adjusting your filters."
                : "No customers have submitted feedback yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-line/20">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Shipment</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Route</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Rating</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Comment</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {feedback.map((f) => (
                  <tr key={f.id} className="hover:bg-line/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground text-xs">{f.customer_name}</p>
                      <p className="text-[11px] text-muted">{f.customer_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-accent">{f.tracking_number}</p>
                      <p className="text-[11px] text-muted">{f.reference}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-foreground">{f.origin}</p>
                      <p className="text-[11px] text-muted">→ {f.destination}</p>
                    </td>
                    <td className="px-4 py-3">
                      <RatingBadge rating={f.rating} />
                      <div className="mt-1">
                        <StarDisplay rating={f.rating} />
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {f.comment ? (
                        <p className="text-xs text-foreground italic line-clamp-2">&ldquo;{f.comment}&rdquo;</p>
                      ) : (
                        <span className="text-[11px] text-muted">No comment</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs text-foreground">{shortDate(f.submitted_at)}</p>
                      <p className="text-[11px] text-muted">
                        Delivered {shortDate(f.delivered_at)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rating distribution */}
      {total > 0 && (
        <div className="rounded-lg border border-line bg-background px-5 py-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-muted" />
            <h2 className="text-sm font-medium text-foreground">Rating Distribution</h2>
          </div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((r) => {
              const count = feedback.filter((f) => f.rating === r).length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={r} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16 shrink-0">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs text-muted">{r}</span>
                  </div>
                  <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-12 text-right shrink-0">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
