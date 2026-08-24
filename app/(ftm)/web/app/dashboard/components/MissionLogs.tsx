import type { DashboardTrip } from "../page";

export default function MissionLogs({ trips }: { trips: DashboardTrip[] }) {
  return (
    <section className="panel p-4 rounded-sm bg-panel-gradient h-48 flex-shrink-0 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="panel-title text-sm font-semibold text-text uppercase tracking-wider">
          Mission Logs
        </h2>
        <a href="#" className="text-xs text-brand font-medium hover:underline">
          View All
        </a>
      </div>
      <div className="overflow-y-auto flex-1 pr-2">
        <div className="grid grid-cols-2 gap-4">
          {trips.slice(0, 6).map((trip, i) => (
            <div
              key={trip.id || i}
              className="bg-white border border-border p-2 rounded-sm text-xs hover:border-brand/50 transition-colors shadow-sm"
            >
              <div className="flex justify-between items-center border-b border-border/50 pb-1 mb-1">
                <span className="font-bold text-text">{trip.fromLocation || "Origin unavailable"}</span>
                <span className="text-[10px] text-text-muted">Playback</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-text-muted mt-2">
                <div>
                  <div className="text-text font-medium mb-0.5 truncate">Trip {trip.id || "unidentified"}</div>
                  <div className="truncate text-[10px]">{trip.status || "Status unavailable"}</div>
                </div>
                <div className="text-right">
                  <div className="text-text mb-0.5 font-medium">{trip.toLocation || "Destination unavailable"}</div>
                  <div className="text-brand font-semibold">{trip.updatedAt ? new Date(trip.updatedAt).toLocaleDateString() : ""}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
