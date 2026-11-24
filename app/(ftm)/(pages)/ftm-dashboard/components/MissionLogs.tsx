import type { DashboardTrip } from "../page";

export default function MissionLogs({ trips }: { trips: DashboardTrip[] }) {
  return (
    <section className="panel w-full p-4 rounded-sm bg-panel-gradient h-48 flex-shrink-0 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="panel-title text-sm font-semibold text-text uppercase tracking-wider">
          Mission Logs
        </h2>
        <a href="#" className="text-xs text-brand font-medium hover:underline">
          View All
        </a>
      </div>
      <div className="overflow-y-auto flex-1 pr-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trips.slice(0, 6).map((trip, i) => {
            const proof = trip.proofOfDelivery || trip.proof_of_delivery;
            const deliveryProofUrl = proof?.delivery_photo_url || proof?.receiver_signature_url;
            return (
              <div
                key={trip.id || i}
                className="min-w-0 bg-white border border-border p-2 rounded-sm text-xs hover:border-brand/50 transition-colors shadow-sm"
              >
                <div className="flex justify-between items-center border-b border-border/50 pb-1 mb-1">
                  <span className="font-bold text-text">{trip.fromLocation || "Origin unavailable"}</span>
                  <span className="text-[10px] text-text-muted">{trip.events?.length ? `${trip.events.length} updates` : "Trip"}</span>
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
                {(trip.pickup_proof_url || deliveryProofUrl || proof?.receiver_name) && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-2 text-[10px]">
                    {trip.pickup_proof_url && <a className="text-brand hover:underline" href={trip.pickup_proof_url} target="_blank" rel="noreferrer">Pickup proof</a>}
                    {deliveryProofUrl && <a className="text-brand hover:underline" href={deliveryProofUrl} target="_blank" rel="noreferrer">Delivery proof</a>}
                    {proof?.receiver_name && <span className="text-text-muted">Received by {proof.receiver_name}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
