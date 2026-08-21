function normalizeRoutePlan(record = {}) {
  return {
    ...record,
    pickupLocation: record.pickup_location,
    pickupLatitude: record.pickup_latitude ?? null,
    pickupLongitude: record.pickup_longitude ?? null,
    deliveryDestinations: Array.isArray(record.delivery_destinations) ? record.delivery_destinations : [],
    routeGeojson: record.route_geojson || null,
    distanceKm: record.distance_km ?? null,
    durationMinutes: record.estimated_duration_min ?? null,
    plannedDeliveryDate: record.planned_delivery_date || null,
  };
}

function buildRoutePlanPayload(record = {}) {
  return {
    id: record.id || record.route_plan_id || null,
    courier: record.courier || null,
    pickup_location: record.pickup_location || record.pickupLocation || null,
    pickup_latitude: record.pickup_latitude ?? record.pickupLatitude ?? null,
    pickup_longitude: record.pickup_longitude ?? record.pickupLongitude ?? null,
    delivery_destinations: Array.isArray(record.delivery_destinations)
      ? record.delivery_destinations
      : Array.isArray(record.deliveryDestinations)
        ? record.deliveryDestinations
        : [],
    route_geojson: record.route_geojson || record.routeGeojson || null,
    distance_km: record.distance_km ?? record.distanceKm ?? null,
    estimated_duration_min: record.estimated_duration_min ?? record.durationMinutes ?? null,
    planned_delivery_date: record.planned_delivery_date || record.plannedDeliveryDate || null,
    // Must be one of draft/assigned/in_progress/completed/cancelled — the
    // DB check constraint rejects anything else (e.g. the old 'Active').
    status: record.status || 'draft',
    generated_by: record.generated_by || 'OR-Tools',
    created_by: record.created_by || null,
  };
}

module.exports = { normalizeRoutePlan, buildRoutePlanPayload };
