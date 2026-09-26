function normalizeVehicle(vehicle = {}) {
  return {
    ...vehicle,
    // `plate_number` is the canonical database column. `plate` and
    // `plateNumber` are response aliases kept for older frontend consumers.
    type: vehicle.vehicle_type || vehicle.type,
    plate: vehicle.plate_number || vehicle.plate,
    capacity: vehicle.capacity_kg ?? vehicle.capacity ?? null,
    fuelEfficiency: vehicle.fuel_efficiency ?? vehicle.fuelEfficiency ?? null,
    locationLat: vehicle.location_lat ?? vehicle.locationLat ?? null,
    locationLng: vehicle.location_lng ?? vehicle.locationLng ?? null,
    lastService: vehicle.last_service ?? vehicle.lastService ?? null,
    nextService: vehicle.next_service ?? vehicle.nextService ?? null,
    // camelCase aliases expected by frontend types
    plateNumber: vehicle.plate_number || vehicle.plate || vehicle.plateNumber || null,
    vehicleType: vehicle.vehicle_type || vehicle.type || vehicle.vehicleType || null,
    capacityKg: vehicle.capacity_kg ?? vehicle.capacity ?? vehicle.capacityKg ?? null,
    courierId: vehicle.courier_id || vehicle.courierId || null,
    mileage: vehicle.mileage ?? vehicle.odometer ?? null,
  };
}

function buildVehiclePayload(vehicle = {}) {
  const { locationLat, locationLng, fuelEfficiency, lastService, nextService, ...vehicleFields } = vehicle || {};
  return {
    ...vehicleFields,
    id: vehicleFields.id || vehicleFields.vehicle_id || null,
    plate_number: vehicle?.plate_number || vehicle?.plate || null,
    vehicle_type: vehicle?.vehicle_type || vehicle?.type || null,
    capacity_kg: vehicle?.capacity_kg ?? vehicle?.capacity ?? null,
    fuel_efficiency: vehicle?.fuel_efficiency ?? fuelEfficiency ?? null,
    location_lat: vehicle?.location_lat ?? locationLat ?? null,
    location_lng: vehicle?.location_lng ?? locationLng ?? null,
    last_service: vehicle?.last_service ?? lastService ?? null,
    next_service: vehicle?.next_service ?? nextService ?? null,
  };
}

module.exports = { normalizeVehicle, buildVehiclePayload };
