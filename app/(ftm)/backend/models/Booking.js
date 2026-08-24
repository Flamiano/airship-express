function normalizeBooking(record = {}) {
  return {
    ...record,
    // Keep original raw fields but expose convenient aliases
    pickupLocation: record.pickup_location,
    dropoffLocation: record.dropoff_location,
    bookingDate: record.booking_date || record.bookingDate,
    routePlanId: record.route_plan_id ?? record.routePlanId ?? null,
    // Coordinates if present
    pickup_latitude: record.pickup_latitude ?? record.pickupLatitude ?? null,
    pickup_longitude: record.pickup_longitude ?? record.pickupLongitude ?? null,
    dropoff_latitude: record.dropoff_latitude ?? record.dropoffLatitude ?? null,
    dropoff_longitude: record.dropoff_longitude ?? record.dropoffLongitude ?? null,
    // Route plan destinations (array of { name, lat?, lng? })
    delivery_destinations: Array.isArray(record.delivery_destinations) ? record.delivery_destinations : (record.deliveryDestinations || []),
    deliveryDestinations: Array.isArray(record.delivery_destinations) ? record.delivery_destinations : (record.deliveryDestinations || []),
    // metadata
    cargo_weight: record.cargo_weight ?? record.total_weight_kg ?? record.totalWeightKg ?? null,
    parcel_ids: Array.isArray(record.parcel_ids) ? record.parcel_ids : (record.parcelIds || []),
  };
}

function buildBookingPayload(record = {}) {
  return {
    id: record.id || record.booking_id || null,
    customer_id: record.customer_id || record.customerId || null,
    route_plan_id: record.route_plan_id ?? record.routePlanId ?? null,
    booking_date: record.booking_date || record.bookingDate || null,
    pickup_location: record.pickup_location || record.pickupLocation || null,
    pickup_latitude: record.pickup_latitude ?? record.pickupLatitude ?? null,
    pickup_longitude: record.pickup_longitude ?? record.pickupLongitude ?? null,
    dropoff_location: record.dropoff_location || record.dropoffLocation || null,
    dropoff_latitude: record.dropoff_latitude ?? record.dropoffLatitude ?? null,
    dropoff_longitude: record.dropoff_longitude ?? record.dropoffLongitude ?? null,
    delivery_destinations: Array.isArray(record.delivery_destinations) ? record.delivery_destinations : (record.deliveryDestinations || null),
    status: record.status || 'Pending',
    notes: record.notes || null,
  };
}

module.exports = { normalizeBooking, buildBookingPayload };
