import type { DashboardBooking, DashboardTrip } from "../page";

export default function NewsAlerts({ trips, bookings }: { trips: DashboardTrip[]; bookings: DashboardBooking[] }) {
  const items = [
    ...trips.slice(0, 3).map((trip) => ({
      text: `Trip ${trip.id || "unidentified"} is ${trip.status || "without a status"}.`,
      tag: "Trip Update",
      date: trip.updatedAt ? new Date(trip.updatedAt).toLocaleDateString() : "Recent",
      dateClass: /cancel|fail|error/i.test(trip.status || "") ? "text-accent1" : "text-brand",
    })),
    ...bookings.slice(0, 2).map((booking) => ({
      text: `Booking ${booking.id || "unidentified"} is ${booking.status || "without a status"}.`,
      tag: "Booking Update",
      date: booking.created_at ? new Date(booking.created_at).toLocaleDateString() : "Recent",
      dateClass: "text-brand",
    })),
  ];
  return (
    <section className="panel p-4 rounded-sm bg-panel-gradient flex-1 min-h-[200px] flex flex-col">
      <h2 className="panel-title text-sm font-semibold mb-4 text-text uppercase tracking-wider">
        News &amp; Alerts
      </h2>
      <ul className="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
        {items.map((item, i) => (
          <li
            key={i}
            className={`flex justify-between items-start group cursor-pointer ${
              i < items.length - 1 ? "border-b border-border/50 pb-2" : ""
            }`}
          >
            <span className="text-text group-hover:text-brand transition-colors line-clamp-2 w-3/5 font-medium">
              {item.text}
            </span>
            <div className="text-right w-2/5">
              <span className="text-[10px] text-text-muted block font-semibold uppercase">
                {item.tag}
              </span>
              <span className={`${item.dateClass} font-medium`}>{item.date}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
