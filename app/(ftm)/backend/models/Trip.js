function normalizeTrip(record = {}) {
  const rawStatus = String(record.status || '').trim().toLowerCase();
  const estimatedArrival = record.estimated_arrival || record.estimatedArrival;
  const arrivalTime = estimatedArrival ? new Date(estimatedArrival).getTime() : NaN;
  const isActiveStatus = /in transit|in_transit|transit|assigned|scheduled|dispatch|moving|en route|active/.test(rawStatus);
  const lastActivity = record.updated_at || record.updatedAt || record.created_at || record.createdAt;
  const lastActivityTime = lastActivity ? new Date(lastActivity).getTime() : NaN;
  const staleCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const isOverdue = isActiveStatus && (
    (Number.isFinite(arrivalTime) && arrivalTime < Date.now()) ||
    (!Number.isFinite(arrivalTime) && Number.isFinite(lastActivityTime) && lastActivityTime < staleCutoff)
  );

  return {
    ...record,
    // legacy keys
    vehicle: record.vehicle_id,
    driver: record.driver_name || record.driver_id,
    from: record.from_location,
    to: record.to_location,
    distanceKm: record.distance_km,
    durationMinutes: record.duration_minutes,
    loadKg: record.load_kg,
    fromLocation: record.from_location,
    toLocation: record.to_location,
    fromCoords: (record.from_latitude && record.from_longitude) ? { lat: record.from_latitude, lng: record.from_longitude } : null,
    toCoords: (record.to_latitude && record.to_longitude) ? { lat: record.to_latitude, lng: record.to_longitude } : null,
    // camelCase aliases expected by frontend
    bookingId: record.booking_id || record.bookingId || null,
    vehicleId: record.vehicle_id || record.vehicleId || null,
    driverId: record.driver_id || record.driverId || null,
    status: isOverdue ? 'Delayed' : (record.status || null),
    progress: record.progress != null ? Number(record.progress) : null,
    estimatedDeparture: record.estimated_departure || record.estimatedDeparture || null,
    estimatedArrival: record.estimated_arrival || record.estimatedArrival || null,
    actualDeparture: record.actual_departure || record.actualDeparture || null,
    actualArrival: record.actual_arrival || record.actualArrival || null,
    createdAt: record.created_at || record.createdAt || null,
    updatedAt: record.updated_at || record.updatedAt || null,
  };
}

function buildTripPayload(trip = {}) {
  const vehicleId = trip?.vehicle_id || trip?.vehicle;
  const fromLocation = trip?.from_location || trip?.from;
  const toLocation = trip?.to_location || trip?.to;
  const fromLat = trip?.from_latitude || trip?.fromCoords?.lat;
  const fromLng = trip?.from_longitude || trip?.fromCoords?.lng;
  const toLat = trip?.to_latitude || trip?.toCoords?.lat;
  const toLng = trip?.to_longitude || trip?.toCoords?.lng;

  return {
    id: trip.id || trip.trip_id || null,
    booking_id: trip.booking_id || null,
    vehicle_id: vehicleId || null,
    driver_id: trip.driver_id || null,
    driver_name: trip.driver_name || trip.driver || null,
    from_location: fromLocation || null,
    to_location: toLocation || null,
    from_latitude: fromLat || null,
    from_longitude: fromLng || null,
    to_latitude: toLat || null,
    to_longitude: toLng || null,
    status: trip.status || 'Assigned',
    progress: Number(trip.progress || 0),
    distance_km: trip.distance_km ?? trip.distanceKm ?? null,
    duration_minutes: trip.duration_minutes ?? trip.durationMinutes ?? null,
    load_kg: trip.load_kg ?? trip.loadKg ?? null,
    scheduled_at: trip.scheduled_at ?? trip.scheduledAt ?? null,
    notes: trip.notes || null,
  };
}

module.exports = { normalizeTrip, buildTripPayload };
