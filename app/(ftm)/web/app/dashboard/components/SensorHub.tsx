import type { DashboardVehicle, DashboardTrip } from "../page";

export default function SensorHub({ vehicles, trips }: { vehicles: DashboardVehicle[]; trips: DashboardTrip[] }) {
  const locatedVehicles = vehicles.filter((vehicle) => vehicle.locationLat != null && vehicle.locationLng != null);
  
  // Get location name from first active trip
  let displayLocation: string = "Location unavailable";
  
  // Try to get location name from first active trip
  const activeTrip = trips.find(t => 
    /transit|assigned|scheduled|dispatch|active|in_transit|moving/i.test(t.status || "")
  );
  
  if (activeTrip) {
    // Prefer pickup location, then destination
    const pickupLocation = activeTrip.pickup_location || activeTrip.pickup_zone || activeTrip.fromLocation;
    const destinationLocation = activeTrip.destination_location || activeTrip.destination_zone || activeTrip.toLocation;
    
    if (pickupLocation) {
      displayLocation = pickupLocation;
    } else if (destinationLocation) {
      displayLocation = destinationLocation;
    }
  }
  
  const capacity = vehicles.reduce((total, vehicle) => total + Number(vehicle.capacityKg || 0), 0);
  const displayNodeCount = locatedVehicles.length;
  const displayCapacity = capacity;
  
  return (
    <section className="panel p-4 rounded-sm bg-panel-gradient h-48 flex-shrink-0 flex flex-col">
      <h2 className="panel-title text-sm font-semibold mb-4 text-text uppercase tracking-wider">
        Sensor Hub
      </h2>
      <div className="flex items-center justify-between flex-1">
        <div className="relative w-20 h-20">
          <div
            className="w-full h-full rounded-full border-4 border-surface-bright relative flex items-center justify-center bg-white shadow-inner"
            style={{
              borderTopColor: "#b80049",
              borderRightColor: "#b80049",
              transform: "rotate(-45deg)",
            }}
          >
            <div className="text-center" style={{ transform: "rotate(45deg)" }}>
              <span className="data-value text-xl leading-none block">{displayNodeCount}</span>
              <span className="text-[9px] text-text-muted uppercase font-semibold">Nodes</span>
            </div>
          </div>
        </div>
        <div className="flex-1 ml-6 space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1 font-medium text-text">
                <span className="w-2 h-2 rounded-full bg-brand" /> Location
              </span>
              <span className="text-brand font-bold">{displayLocation}</span>
            </div>
            <div className="stat-bar w-full">
              <div className="stat-fill w-full" />
            </div>
            <div className="text-text-muted text-xs mt-0.5">Latest vehicle location</div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1 font-medium text-text">
                <span className="w-2 h-2 rounded-full bg-accent1" /> Vehicle Capacity
              </span>
              <span className="text-accent1 font-bold">{displayCapacity.toLocaleString()} kg</span>
            </div>
            <div className="stat-bar w-full">
              <div className="stat-fill w-full !bg-accent1" />
            </div>
            <div className="text-text-muted text-xs mt-0.5">Registered vehicle capacity</div>
          </div>
        </div>
      </div>
    </section>
  );
}
