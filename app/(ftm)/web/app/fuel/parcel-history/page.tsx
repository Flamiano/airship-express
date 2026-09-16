"use client";

import { useEffect, useMemo, useState } from "react";
import GlobalFooter from "../../components/GlobalFooter";
import GlobalNavbar from "../../components/GlobalNavbar";
import { getParcelHistory } from "../../lib/api";

type ParcelHistoryRecord = {
  id?: string;
  tracking_number?: string;
  trackingNumber?: string;
  courier?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  destination?: string;
  dropoff_location?: string;
  recipient_name?: string;
  delivered_at?: string;
  cancelled_at?: string;
  delay_reason?: string;
};

function formatDate(value?: string) {
  if (!value) return "No date recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No date recorded" : date.toLocaleString();
}

export default function ParcelHistoryPage() {
  const [parcels, setParcels] = useState<ParcelHistoryRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [dateRange, setDateRange] = useState("All time");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getParcelHistory()
      .then((data) => {
        if (active) setParcels(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setError("Unable to load parcel history right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const statuses = useMemo(() => Array.from(new Set(parcels.map((parcel) => String(parcel.status || "Unknown")))).sort(), [parcels]);
  const filteredParcels = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return parcels.filter((parcel) => {
      const tracking = String(parcel.tracking_number || parcel.trackingNumber || "").toLowerCase();
      const recipient = String(parcel.recipient_name || "").toLowerCase();
      const courier = String(parcel.courier || "").toLowerCase();
      const matchesSearch = !query || [tracking, recipient, courier].some((value) => value.includes(query));
      const matchesStatus = status === "All statuses" || String(parcel.status || "Unknown") === status;
      const timestamp = new Date(parcel.updated_at || parcel.delivered_at || parcel.cancelled_at || parcel.created_at || 0).getTime();
      const matchesDate = dateRange === "All time"
        || (dateRange === "Last 7 days" && Number.isFinite(timestamp) && now - timestamp <= sevenDays)
        || (dateRange === "Older than 7 days" && Number.isFinite(timestamp) && now - timestamp > sevenDays);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [dateRange, parcels, search, status]);

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <GlobalNavbar />
      <main className="mx-auto w-full max-w-[1850px] space-y-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="rounded-2xl border border-pink-100 bg-white/80 p-6 shadow-sm backdrop-blur-md">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-600">Gallery / Parcel History</p>
          <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Parcel History</h1>
              <p className="mt-1 text-sm text-slate-500">Review parcel records, courier assignments, and the latest recorded movement.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="parcel-history-search">Search parcels</label>
              <input id="parcel-history-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tracking, recipient, courier" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-pink-200 focus:ring-2" />
              <label className="sr-only" htmlFor="parcel-history-status">Filter parcel status</label>
              <select id="parcel-history-status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-pink-200 focus:ring-2">
                <option>All statuses</option>
                {statuses.map((item) => <option key={item}>{item}</option>)}
              </select>
              <label className="sr-only" htmlFor="parcel-history-date">Filter parcel age</label>
              <select id="parcel-history-date" value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-pink-200 focus:ring-2">
                <option>All time</option>
                <option>Last 7 days</option>
                <option>Older than 7 days</option>
              </select>
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm">
          {loading ? <div className="p-8 text-sm text-slate-500">Loading parcel history...</div> : error ? <div role="alert" className="p-8 text-sm text-rose-600">{error}</div> : filteredParcels.length === 0 ? <div className="p-8 text-sm text-slate-500">No parcel history records match your filters.</div> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-3 font-black">Tracking</th><th className="px-5 py-3 font-black">Courier</th><th className="px-5 py-3 font-black">Recipient</th><th className="px-5 py-3 font-black">Status</th><th className="px-5 py-3 font-black">Delay / outcome</th><th className="px-5 py-3 font-black">Last recorded</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParcels.map((parcel) => <tr key={parcel.id || parcel.tracking_number} className="hover:bg-pink-50/40"><td className="px-5 py-4 font-bold text-slate-900">{parcel.tracking_number || parcel.trackingNumber || "Untracked"}</td><td className="px-5 py-4 text-slate-600">{parcel.courier || "Unknown"}</td><td className="px-5 py-4 text-slate-600">{parcel.recipient_name || "Not recorded"}</td><td className="px-5 py-4"><span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-pink-700">{parcel.status || "Unknown"}</span></td><td className="px-5 py-4 text-slate-500">{parcel.delay_reason || (/delay|late/i.test(parcel.status || "") ? "Delayed delivery" : "—")}</td><td className="px-5 py-4 text-slate-500">{formatDate(parcel.updated_at || parcel.delivered_at || parcel.cancelled_at || parcel.created_at)}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}