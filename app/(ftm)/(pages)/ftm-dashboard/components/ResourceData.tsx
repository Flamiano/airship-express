import { useMemo, useState } from "react";
import type { DashboardBooking, DashboardTrip } from "../page";

export default function ResourceData({ bookings, trips = [] }: { bookings: DashboardBooking[]; trips?: DashboardTrip[] }) {
  const [period, setPeriod] = useState<"All" | "Today" | "Week">("All");
  const filteredBookings = useMemo(() => filterByPeriod(bookings, period), [bookings, period]);
  const filteredTrips = useMemo(() => filterByPeriod(trips, period), [trips, period]);
  
  const statuses = ["pending", "assigned", "in-transit", "completed"];
  const bars = statuses.map((status, index) => {
    const count = [...filteredBookings, ...filteredTrips].filter((record) => {
      const rawStatus = String(record.status || "").toLowerCase().replace(/[_\s]+/g, "-");
      if (status === "in-transit") return /in-transit|transit|dispatch|moving|en-route/.test(rawStatus);
      if (status === "assigned") return /assigned|approved|ready/.test(rawStatus);
      if (status === "completed") return /completed|delivered|finished/.test(rawStatus);
      return /pending|booked|requested|new/.test(rawStatus);
    }).length;
    
    return {
      label: status,
      value: count,
      color: index % 2 === 0 ? "bg-brand" : "bg-accent1",
      textClass: index % 2 === 0 ? "data-value" : "text-accent1 font-bold",
    };
  });
  
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);
  
  return (
    <section className="panel p-4 rounded-sm bg-panel-gradient flex-1 min-h-[250px]">
      <h2 className="panel-title text-sm font-semibold mb-4 text-text uppercase tracking-wider">
        Resource Data
      </h2>
      <div className="flex justify-between items-center mb-6 text-xs">
        <div className="flex gap-2">
          {(["All", "Today", "Week"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={period === option
                ? "px-2 py-1 bg-brand/10 text-brand border border-brand/30 rounded-sm"
                : "px-2 py-1 text-text-muted hover:text-text transition-colors rounded-sm"}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-text-muted font-medium">Units</div>
      </div>
      <div className="h-32 w-full flex items-end justify-around pb-2 border-b border-border relative">
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-text-muted pb-2">
          <span>{Math.ceil(maxValue / 2)}</span>
          <span>{Math.ceil(maxValue / 4)}</span>
          <span>0</span>
        </div>
        {bars.map((bar, i) => (
          <div
            key={bar.label}
            className={`flex flex-col items-center gap-1 group w-1/4 ${i === 0 ? "ml-4" : ""}`}
          >
            <div className={`${bar.textClass} text-xs opacity-0 group-hover:opacity-100 transition-opacity`}>
              {bar.value}
            </div>
            <div
              className={`w-6 ${bar.color} hover:opacity-80 transition-opacity rounded-t-sm`}
              style={{ height: `${Math.max((bar.value / maxValue) * 100, 5)}%` }}
            />
            <span className="text-[10px] text-text-muted mt-1 font-medium capitalize">{bar.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function filterByPeriod(records: Array<DashboardBooking | DashboardTrip>, period: "All" | "Today" | "Week") {
  if (period === "All") return records;
  const now = new Date();
  const start = new Date(now);
  if (period === "Today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }
  return records.filter((record) => {
    const timestampedRecord = record as DashboardBooking & DashboardTrip;
    const timestamp = new Date(timestampedRecord.created_at ?? timestampedRecord.createdAt ?? timestampedRecord.updated_at ?? timestampedRecord.updatedAt ?? 0).getTime();
    return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= now.getTime();
  });
}
