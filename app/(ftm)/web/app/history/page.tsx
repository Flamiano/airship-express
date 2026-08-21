"use client";

import { useEffect, useMemo, useState } from "react";
import { optimizeRoute, SAMPLE_OPTIMIZATION_PAYLOAD } from "../lib/optimize";
import { getTrips } from "../lib/api";
import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";

export default function VrdsHistoryPage() {
  const [dateSortDirection, setDateSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedDriverGroup, setSelectedDriverGroup] = useState<"All Drivers" | "Senior Drivers" | "Backup Drivers">("All Drivers");
  const [selectedDateRange, setSelectedDateRange] = useState<"Last 30 Days" | "Last 7 Days" | "This Month">("Last 30 Days");
  const [optimizationMessage, setOptimizationMessage] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const historySummary = useMemo(() => {
    const totalDeliveries = history.length;
    const completedHistory = history.filter((item) => item.status === "Completed");
    const efficiencyValues = completedHistory
      .map((item) => item.efficiency)
      .filter((value): value is number => value != null && !Number.isNaN(value));

    const averageEfficiency = efficiencyValues.length
      ? efficiencyValues.reduce((sum, value) => sum + value, 0) / efficiencyValues.length
      : null;

    const averageDriverRating = averageEfficiency != null
      ? Math.round((averageEfficiency / 20) * 10) / 10
      : null;

    return {
      totalDeliveries,
      averageDriverRating,
      averageEfficiency,
      recordCount: totalDeliveries,
    };
  }, [history]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    getTrips()
      .then((trips) => {
        if (!active) return;
        setHistory((trips || []).map(mapTripToHistory));
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load delivery history:", error);
        setLoadError("Unable to load delivery history. Please try again later.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const dateRanges = ["Last 30 Days", "Last 7 Days", "This Month"] as const;
  const driverGroups = ["All Drivers", "Senior Drivers", "Backup Drivers"] as const;

  const sortedHistory = useMemo(() => {
    const direction = dateSortDirection === "asc" ? 1 : -1;
    return [...history].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return (dateA - dateB) * direction;
    });
  }, [dateSortDirection, history]);

  const toggleDateSort = () => setDateSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  
  const cycleDateRange = () => {
    const nextIndex = (dateRanges.indexOf(selectedDateRange) + 1) % dateRanges.length;
    setSelectedDateRange(dateRanges[nextIndex]);
  };
  
  const cycleDriverGroup = () => {
    const nextIndex = (driverGroups.indexOf(selectedDriverGroup) + 1) % driverGroups.length;
    setSelectedDriverGroup(driverGroups[nextIndex]);
  };

  const handleReroute = async () => {
    setOptimizing(true);
    setOptimizationMessage(null);
    try {
      const result = await optimizeRoute(SAMPLE_OPTIMIZATION_PAYLOAD);
      setOptimizationMessage(
        `OR-Tools reroute ready — ETA ${result.etaMinutes} min, ${result.distanceMi.toFixed(1)} mi.`
      );
    } catch {
      setOptimizationMessage("OR-Tools optimization unavailable, using fallback route.");
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-inherit font-sans">
      <GlobalNavbar />

      {/* Main Full-Width Dashboard Container */}
      <main className="flex-1 w-full max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
        
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-pink-100 shadow-sm shadow-pink-500/5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Delivery History & Logs
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700 border border-pink-200/80">
                <span className="material-symbols-outlined text-[15px] text-pink-600">history</span>
                Archival Records
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Archival view of completed dispatches, driver efficiency logs, and historical performance metrics.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Filter Buttons */}
            <div className="relative">
              <label className="sr-only">Driver Group</label>
              <div className={`rounded-xl border px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-sm ${selectedDriverGroup === "All Drivers" ? "border-pink-200 bg-pink-50 text-pink-700" : "border-slate-200 bg-white text-slate-700"}`}>
                <span className="material-symbols-outlined text-[16px] text-pink-600">group</span>
                <span className="truncate">{selectedDriverGroup}</span>
                <span className="material-symbols-outlined ml-2">expand_more</span>
              </div>
              <select
                aria-label="Driver Group"
                value={selectedDriverGroup}
                onChange={(e) => setSelectedDriverGroup(e.target.value as any)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {driverGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="sr-only">Date Range</label>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 inline-flex items-center gap-2 transition-all shadow-sm">
                <span className="material-symbols-outlined text-[16px] text-pink-600">calendar_today</span>
                <span className="truncate">{selectedDateRange}</span>
                <span className="material-symbols-outlined ml-2">expand_more</span>
              </div>
              <select
                aria-label="Date Range"
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value as any)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {dateRanges.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleReroute}
              disabled={optimizing}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-pink-600/20 hover:from-pink-700 hover:to-rose-700 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">
                {optimizing ? "sync" : "alt_route"}
              </span>
              {optimizing ? "Recalculating..." : "Test Route Optimization"}
            </button>
          </div>
        </div>

        {/* Global Action / Notification Banner */}
        {optimizationMessage && (
          <div className="rounded-xl border border-pink-200 bg-pink-50/90 backdrop-blur-sm px-5 py-3.5 text-pink-900 text-sm font-medium flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-pink-600 text-[20px]">
                info
              </span>
              <span>{optimizationMessage}</span>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sidebar Summary Card (Spans 3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-pink-100 shadow-sm shadow-pink-500/5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-pink-50 text-pink-600 border border-pink-100">
                    <span className="material-symbols-outlined text-[20px] block">analytics</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">30-Day Summary</h3>
                    <p className="text-xs text-slate-500">Historical fleet efficiency</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {/* Metric Box 1 */}
                  <div className="rounded-xl bg-gradient-to-br from-pink-50/50 to-rose-50/30 p-4 border border-pink-100/80 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Total Deliveries
                      </div>
                      <div className="text-3xl font-black text-slate-900 mt-0.5">{historySummary.totalDeliveries}</div>
                      <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-0.5 mt-1">
                        <span className="material-symbols-outlined text-[13px]">trending_up</span>
                        +12% vs last month
                      </span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-pink-600/10 text-pink-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">local_shipping</span>
                    </div>
                  </div>

                  {/* Metric Box 2 */}
                  <div className="rounded-xl bg-gradient-to-br from-pink-50/50 to-rose-50/30 p-4 border border-pink-100/80 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Average Driver Rating
                      </div>
                      <div className="text-3xl font-black text-slate-900 mt-0.5 flex items-center gap-1.5">
                        {historySummary.averageDriverRating ?? "—"} <span className="text-amber-500 text-2xl">★</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                        Based on {historySummary.recordCount} records
                      </span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">star</span>
                    </div>
                  </div>

                  {/* Metric Box 3 */}
                  <div className="rounded-xl bg-gradient-to-br from-pink-50/50 to-rose-50/30 p-4 border border-pink-100/80 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Avg Route Efficiency
                      </div>
                      <div className="text-3xl font-black text-slate-900 mt-0.5">{historySummary.averageEfficiency != null ? `${historySummary.averageEfficiency.toFixed(1)}%` : "—"}</div>
                      <span className="text-[11px] text-pink-600 font-medium mt-1 block">
                        Optimized by OR-Tools
                      </span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-pink-600/10 text-pink-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">speed</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 text-center">
                Log entries sync automatically every 5 minutes.
              </div>
            </div>
          </div>

          {/* Delivery Log Table Container (Spans 9 cols) */}
          <div className="lg:col-span-9 bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-pink-100 shadow-sm shadow-pink-500/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-pink-600">table_chart</span>
                  <h3 className="text-lg font-bold text-slate-900">Dispatch Log</h3>
                </div>
                
                <button
                  type="button"
                  onClick={() => exportCsv(history)}
                  disabled={loading || history.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-pink-50 hover:bg-pink-100/80 px-4 py-2 text-xs font-bold text-pink-700 border border-pink-200/80 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Export CSV Report
                </button>
              </div>

              {/* Table Wrapper */}
              {loadError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
                  {loadError}
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-pink-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-pink-100">
                        <th className="px-4 py-3.5 rounded-l-xl">Delivery ID</th>
                        <th className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={toggleDateSort}
                            className="inline-flex items-center gap-1.5 font-bold hover:text-pink-600 transition-colors"
                          >
                            Date
                            <span className="material-symbols-outlined text-[16px]">
                              {dateSortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                            </span>
                          </button>
                        </th>
                        <th className="px-4 py-3.5">Distance</th>
                        <th className="px-4 py-3.5">Duration</th>
                        <th className="px-4 py-3.5">Efficiency</th>
                        <th className="px-4 py-3.5 rounded-r-xl">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                            Loading delivery history…
                          </td>
                        </tr>
                      ) : sortedHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                            No delivery history records found.
                          </td>
                        </tr>
                      ) : (
                        sortedHistory.map((h) => (
                          <tr 
                            key={h.id} 
                            className="hover:bg-pink-50/30 transition-colors group"
                          >
                            <td className="px-4 py-4 font-bold text-pink-600 group-hover:underline">
                              #{h.id}
                            </td>
                            <td className="px-4 py-4 text-slate-600">{h.date}</td>
                            <td className="px-4 py-4">{h.distanceMi !== null ? `${h.distanceMi} mi` : "—"}</td>
                            <td className="px-4 py-4">{h.durationMin !== null ? `${h.durationMin} min` : "—"}</td>
                            <td className="px-4 py-4">
                              {h.efficiency !== null ? (
                                <span className="font-semibold text-slate-900">{h.efficiency}%</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold inline-flex items-center gap-1.5 ${
                                  h.status === "Completed"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                                    : "bg-rose-50 text-rose-700 border border-rose-200/80"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    h.status === "Completed" ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                />
                                {h.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Table Footer / Pagination */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-3">
              <span>Showing 1 to {history.length} of {history.length} entries</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg border border-slate-200 hover:border-pink-300 hover:bg-pink-50 flex items-center justify-center transition-all text-slate-600"
                  aria-label="Previous page"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <span className="px-2 font-semibold text-slate-700">Page 1 of 1</span>
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg border border-slate-200 hover:border-pink-300 hover:bg-pink-50 flex items-center justify-center transition-all text-slate-600"
                  aria-label="Next page"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}

// Helper Functions
function exportCsv(history: HistoryEntry[]) {
  const header = ["Delivery ID", "Date", "Distance", "Duration", "Efficiency", "Status"];
  const rows = history.map((h) => [
    h.id,
    h.date,
    h.distanceMi !== null ? `${h.distanceMi} mi` : "—",
    h.durationMin !== null ? `${h.durationMin} min` : "—",
    h.efficiency !== null ? `${h.efficiency}%` : "—",
    h.status,
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "delivery-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function formatHistoryDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function convertKmToMiles(km: number | null | undefined) {
  if (km == null || Number.isNaN(Number(km))) return null;
  return Math.round(Number(km) * 0.621371 * 10) / 10;
}

function haversineKm(a: { lat: number; lng: number } | null, b: { lat: number; lng: number } | null) {
  if (!a || !b) return null;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aVal = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}

function mapTripToHistory(trip: any): HistoryEntry {
  const status = String(trip.status || "Unknown");
  let distanceMi = trip.distanceMi ?? convertKmToMiles(trip.distanceKm ?? trip.distance_km ?? trip.distanceKm ?? null);
  if (distanceMi == null) {
    // try compute from coords
    const from = trip.fromCoords ?? (trip.from_latitude && trip.from_longitude ? { lat: Number(trip.from_latitude), lng: Number(trip.from_longitude) } : null);
    const to = trip.toCoords ?? (trip.to_latitude && trip.to_longitude ? { lat: Number(trip.to_latitude), lng: Number(trip.to_longitude) } : null);
    const km = haversineKm(from, to);
    if (km != null) distanceMi = convertKmToMiles(km);
  }

  let durationMin = trip.durationMin ?? trip.durationMinutes ?? trip.duration_minutes ?? null;
  if (durationMin == null) {
    // try compute from timestamps
    const start = trip.actualDeparture ?? trip.actual_departure ?? trip.estimatedDeparture ?? trip.estimated_departure ?? trip.createdAt ?? trip.created_at ?? null;
    const end = trip.actualArrival ?? trip.actual_arrival ?? trip.estimatedArrival ?? trip.estimated_arrival ?? trip.updatedAt ?? trip.updated_at ?? null;
    if (start && end) {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) {
        durationMin = Math.round((e - s) / 60000);
      }
    }
  }
  const efficiency = trip.progress != null ? Number(trip.progress) : null;
  return {
    id: String(trip.id || trip.bookingId || trip.booking_id || "unknown"),
    date: formatHistoryDate(trip.actualArrival || trip.actual_arrival || trip.updatedAt || trip.updated_at || trip.createdAt || trip.created_at || trip.estimatedArrival || trip.estimated_arrival),
    distanceMi,
    durationMin,
    efficiency,
    status: status === "Completed" ? "Completed" : status,
  };
}

type HistoryEntry = {
  id: string;
  date: string;
  distanceMi: number | null;
  durationMin: number | null;
  efficiency: number | null;
  status: string;
};
