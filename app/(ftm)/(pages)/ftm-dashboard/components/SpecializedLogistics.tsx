import { useMemo, useState } from "react";
import type { DashboardBooking, DashboardTrip, DashboardVehicle } from "../page";

export default function SpecializedLogistics({
  trips,
  vehicles,
  bookings,
}: {
  trips: DashboardTrip[];
  vehicles: DashboardVehicle[];
  bookings: DashboardBooking[];
}) {
  const [period, setPeriod] = useState<"All" | "Today" | "Week">("All");
  const filteredTrips = useMemo(() => filterByPeriod(trips, period, (trip) => trip.createdAt), [trips, period]);
  const filteredBookings = useMemo(() => filterByPeriod(bookings, period, (booking) => booking.created_at), [bookings, period]);
  
  const activeMissions = filteredTrips.filter((trip) => {
    const status = (trip.status || "").toLowerCase();
    return /transit|assigned|scheduled|dispatch|active|in_transit|moving/.test(status);
  }).length;
  
  const sortingNodes = new Set(filteredBookings.map((booking) => booking.pickup_location).filter(Boolean)).size;
  const fleetCapacity = vehicles.reduce((total, vehicle) => total + Number(vehicle.capacityKg || 0), 0);
  const inboundHubs = new Set(filteredBookings.map((booking) => booking.dropoff_location).filter(Boolean)).size;
  
  const stats = [
    { icon: "fa-truck-fast", label: "Active Missions", value: activeMissions },
    { icon: "fa-boxes-stacked", label: "Sorting Nodes", value: sortingNodes },
    { icon: "fa-plane", label: "Fleet Capacity", value: fleetCapacity },
    { icon: "fa-warehouse", label: "Inbound Hubs", value: inboundHubs },
  ];
  
  const volume = filteredTrips.slice(0, 6).map((trip, index) => ({
    day: trip.createdAt ? new Date(trip.createdAt).toLocaleDateString(undefined, { weekday: "short" }) : `Day ${index + 1}`,
    value: Number(trip.loadKg || 0),
  }));
  
  const maxVolume = Math.max(...volume.map((item) => item.value), 1000);

  return (
    <section className="panel p-4 rounded-sm bg-panel-gradient flex-shrink-0">
      <h2 className="panel-title text-sm font-semibold mb-4 text-text uppercase tracking-wider">
        Specialized Logistics
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
      <div className="grid grid-cols-2 gap-4 mb-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 p-2 bg-surface rounded-sm border border-outline-variant shadow-sm"
          >
            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand">
              <i className={`fa-solid ${stat.icon}`} />
            </div>
            <div>
              <div className="text-xs text-text-muted">{stat.label}</div>
              <div className="data-value text-lg">{stat.value.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-outline-variant">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-text-muted">Volume Trend</span>
          <span className="text-brand font-semibold">{filteredTrips.length.toLocaleString()} Total</span>
        </div>
        <div className="flex items-end gap-1 h-20 w-full">
          {volume.map((bar, index) => (
            <div
              key={`${bar.day}-${index}`}
              title={bar.day}
              className={`w-1/6 relative group hover:bg-opacity-80 transition-opacity ${
                index >= volume.length - 2 ? "bg-brand" : "bg-accent1"
              }`}
              style={{ height: `${Math.max((bar.value / maxVolume) * 100, 8)}%` }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-text border border-border px-1 py-0.5 text-[10px] hidden group-hover:block z-10 text-white rounded">
                {bar.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-text-muted mt-1">
          {volume.map((bar, index) => <span key={`${bar.day}-label-${index}`}>{bar.day}</span>)}
        </div>
      </div>
    </section>
  );
}

function filterByPeriod<T>(items: T[], period: "All" | "Today" | "Week", getDate: (item: T) => string | null | undefined) {
  if (period === "All") return items;
  const now = new Date();
  const start = new Date(now);
  if (period === "Today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }
  return items.filter((item) => {
    const date = getDate(item);
    if (!date) return false;
    const timestamp = new Date(date).getTime();
    return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= now.getTime();
  });
}
