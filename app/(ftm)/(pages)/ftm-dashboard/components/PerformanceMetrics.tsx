import { useMemo, useState } from "react";
import type { DashboardTrip, DashboardVehicle } from "../page";

export default function PerformanceMetrics({ trips, vehicles }: { trips: DashboardTrip[]; vehicles: DashboardVehicle[] }) {
  const [period, setPeriod] = useState<"All" | "Today" | "Week">("All");
  const filteredTrips = useMemo(() => filterByPeriod(trips, period), [trips, period]);
  
  // Calculate metrics based on trip and vehicle statuses
  const activeTrips = filteredTrips.filter((trip) => {
    const status = (trip.status || "").toLowerCase();
    return /transit|assigned|scheduled|dispatch|active|in_transit|moving/.test(status);
  }).length;
  
  const completedTrips = filteredTrips.filter((trip) => {
    const status = (trip.status || "").toLowerCase();
    return /complete|delivered|done|finished/.test(status);
  }).length;
  
  const maintenanceVehicles = vehicles.filter((vehicle) => {
    const status = (vehicle.status || "").toLowerCase();
    return /maintenance|service|repair|offline|inactive/.test(status);
  }).length;

  // Calculate availability percentage
  const fleetAvailability = vehicles.length > 0 
    ? Math.round(((vehicles.length - maintenanceVehicles) / vehicles.length) * 100)
    : 0;

  // Calculate outbound percentage
  const outboundDistribution = filteredTrips.length > 0
    ? Math.round((activeTrips / filteredTrips.length) * 100)
    : 0;

  // Calculate efficiency percentage
  const logisticsEfficiency = filteredTrips.length > 0
    ? Math.round((completedTrips / filteredTrips.length) * 100)
    : 0;

  const gauges = [
    { label: "Fleet Availability", value: fleetAvailability, color: "#b80049", textClass: "data-value" },
    { label: "Outbound Distribution", value: outboundDistribution, color: "#e2165f", textClass: "text-accent1 font-bold" },
    { label: "Logistics Efficiency", value: logisticsEfficiency, color: "#8c0036", textClass: "text-brand-dark font-bold" },
  ];
  
  const hubs = Array.from(filteredTrips.reduce((counts, trip) => {
    const name = trip.fromLocation || "Unknown origin";
    counts.set(name, (counts.get(name) || 0) + 1);
    return counts;
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <section className="panel p-4 rounded-sm bg-panel-gradient flex-1 flex flex-col">
      <h2 className="panel-title text-sm font-semibold mb-4 text-text uppercase tracking-wider">
        Performance Metrics
      </h2>
      <div className="flex gap-2 mb-4 text-xs">
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
      <div className="flex justify-between items-center mb-6 px-2">
        {gauges.map((gauge) => (
          <div key={gauge.label} className="flex flex-col items-center">
            <div className="relative w-16 h-16 mb-2">
              <div
                className="w-full h-full rounded-full relative"
                style={{
                  background: `conic-gradient(${gauge.color} 0% ${gauge.value}%, #dae4ec ${gauge.value}% 100%)`,
                  padding: "2px",
                }}
              >
                <div className="w-full h-full bg-background rounded-full flex flex-col items-center justify-center shadow-sm">
                  <span className={`${gauge.textClass} text-xs`}>{gauge.value}%</span>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-text-muted uppercase text-center leading-tight">
              {gauge.label.split(" ")[0]}
              <br />
              {gauge.label.split(" ").slice(1).join(" ")}
            </span>
          </div>
        ))}
      </div>
      <h3 className="text-xs text-text-muted mb-2 uppercase border-b border-border pb-1">
        Top Performing Hubs
      </h3>
      <ul className="space-y-2 text-xs flex-1 overflow-y-auto">
        {hubs.length > 0 ? (
          hubs.map(([name, units], index) => (
            <li
              key={name}
              className="flex justify-between items-center p-2 hover:bg-surface rounded transition-colors border-l-2 border-transparent hover:border-brand bg-white shadow-sm border border-border/50"
            >
              <span className="text-text font-medium">
                {index + 1}. {name}
              </span>
              <span className="text-brand font-semibold">{units} Trips</span>
            </li>
          ))
        ) : (
          <li className="flex items-center justify-center p-4 text-text-muted">
            No hub data available
          </li>
        )}
      </ul>
    </section>
  );
}

function filterByPeriod(trips: DashboardTrip[], period: "All" | "Today" | "Week") {
  if (period === "All") return trips;
  const now = new Date();
  const start = new Date(now);
  if (period === "Today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }
  return trips.filter((trip) => {
    if (!trip.createdAt) return false;
    const timestamp = new Date(trip.createdAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= now.getTime();
  });
}
