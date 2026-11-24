const ACTIVE_TRIP_STATUSES = [
  'assigned',
  'driver assigned',
  'vehicle assigned',
  'scheduled',
  'dispatching',
  'dispatched',
  'in transit',
  'in_transit',
  'delivering',
  'en route',
  'active',
  'moving',
];

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isAvailable(value) {
  const normalized = normalize(value);
  return ['available', 'active', 'idle', 'ready', 'on duty'].some((item) => normalize(item) === normalized);
}

function isUnavailable(value) {
  const normalized = normalize(value);
  return ['maintenance', 'out of service', 'unavailable', 'inactive'].some((item) => normalize(item) === normalized);
}

function resourceIsAvailable(...values) {
  const populated = values.filter((value) => value != null && String(value).trim() !== '');
  return populated.length === 0 || populated.every((value) => !isUnavailable(value));
}

function isActiveTripStatus(value) {
  return ACTIVE_TRIP_STATUSES.some((status) => normalize(status) === normalize(value));
}

function sameCourier(left, right) {
  if (!left || !right) return false;
  if (left.id && right.id) return String(left.id) === String(right.id);
  return normalize(left.name || left) === normalize(right.name || right);
}

async function getCourierByValue(supabase, value) {
  if (!value) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
  const column = isUuid ? 'id' : 'name';
  const { data } = await supabase.from('couriers').select('id, name, code').eq(column, value).maybeSingle();
  if (data) return data;
  if (!isUuid) {
    const { data: byCode } = await supabase.from('couriers').select('id, name, code').eq('code', value).maybeSingle();
    if (byCode) return byCode;
  }
  return { name: String(value) };
}

async function resolveCourierForAssignment(supabase, { bookingId, routePlanId, courierId, courier } = {}) {
  if (courierId || courier) return getCourierByValue(supabase, courierId || courier);

  let booking = null;
  if (bookingId) {
    const result = await supabase.from('bookings').select('route_plan_id, courier, courier_id').eq('id', bookingId).maybeSingle();
    if (!result.error) booking = result.data;
  }

  const effectiveRoutePlanId = routePlanId || booking?.route_plan_id;
  if (effectiveRoutePlanId) {
    const result = await supabase.from('route_plans').select('courier, courier_id').eq('id', effectiveRoutePlanId).maybeSingle();
    if (!result.error && result.data) return getCourierByValue(supabase, result.data.courier_id || result.data.courier);
  }

  return getCourierByValue(supabase, booking?.courier_id || booking?.courier);
}

function getDriverAvailability(driver) {
  if (!driver) return 'available';
  const state = driver.is_active === false ? 'inactive' : 'available';
  return String(state).trim();
}

async function getDriver(supabase, driverId) {
  const { data, error } = await supabase.from('users').select('id, full_name, role, is_active, courier_id').eq('id', driverId).eq('role', 'driver').maybeSingle();
  if (error) throw new Error(`Unable to load driver: ${error.message}`);
  return data;
}

async function getVehicle(supabase, vehicleId) {
  const selectWithAssignmentStatus = 'id, plate_number, status, availability, assignment_status, courier_id';
  const selectLegacy = 'id, plate_number, status, availability, courier_id';
  let { data, error } = await supabase.from('vehicles').select(selectWithAssignmentStatus).eq('id', vehicleId).maybeSingle();
  if (error && /assignment_status|column .* does not exist|schema cache/i.test(String(error.message || error))) {
    ({ data, error } = await supabase.from('vehicles').select(selectLegacy).eq('id', vehicleId).maybeSingle());
  }
  if (error) throw new Error(`Unable to load vehicle: ${error.message}`);
  return data;
}

async function assertDriverNotBusy(supabase, driverId, excludingTripId = null) {
  let query = supabase.from('trips').select('id, status').eq('driver_id', driverId);
  if (excludingTripId) query = query.neq('id', excludingTripId);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to check driver assignments: ${error.message}`);
  if ((data || []).some((trip) => isActiveTripStatus(trip.status))) {
    throw new Error('Driver is already assigned to an active trip.');
  }
}

async function vehicleHasActiveTrip(supabase, vehicleId, excludingTripId = null) {
  let query = supabase.from('trips').select('id, status').eq('vehicle_id', vehicleId);
  if (excludingTripId) query = query.neq('id', excludingTripId);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to check vehicle assignments: ${error.message}`);
  return (data || []).some((trip) => isActiveTripStatus(trip.status));
}

async function validateAssignment(supabase, { driverId, vehicleId, bookingId, routePlanId, courierId, courier, tripId } = {}) {
  if (!driverId || !vehicleId) throw new Error('A driver and vehicle are required for assignment.');

  const targetCourier = await resolveCourierForAssignment(supabase, { bookingId, routePlanId, courierId, courier });
  if (!targetCourier) throw new Error('The shipment courier could not be identified. Assign a registered courier before dispatch.');

  const [driver, vehicle] = await Promise.all([getDriver(supabase, driverId), getVehicle(supabase, vehicleId)]);
  if (!driver) throw new Error('Driver not found.');
  if (!vehicle) throw new Error('Vehicle not found.');
  let assignedToCurrentTrip = false;
  if (tripId) {
    const { data: currentTrip } = await supabase.from('trips').select('driver_id').eq('id', tripId).maybeSingle();
    assignedToCurrentTrip = String(currentTrip?.driver_id || '') === String(driverId);
  }
  const driverStatus = getDriverAvailability(driver);
  if (driver.is_active === false || (!isAvailable(driverStatus) && !assignedToCurrentTrip)) throw new Error('Driver is not available for assignment.');
  let vehicleAssignedToCurrentTrip = false;
  if (tripId) {
    const { data: currentTrip } = await supabase.from('trips').select('vehicle_id').eq('id', tripId).maybeSingle();
    vehicleAssignedToCurrentTrip = String(currentTrip?.vehicle_id || '') === String(vehicleId);
  }
  const vehicleStatusValues = [vehicle.status, vehicle.availability, vehicle.assignment_status];
  const vehicleIsAssigned = vehicleStatusValues.some((value) => ['assigned', 'busy', 'in use'].includes(normalize(value)));
  const vehicleHasTrip = vehicleIsAssigned && await vehicleHasActiveTrip(supabase, vehicleId, tripId);
  if ((!resourceIsAvailable(...vehicleStatusValues) || vehicleHasTrip) && !vehicleAssignedToCurrentTrip) throw new Error('Vehicle is not available for assignment.');
  if (!driver.courier_id) throw new Error('Driver is not associated with a courier. Assign the driver to a registered courier first.');
  if (!vehicle.courier_id) throw new Error('Vehicle is not associated with a courier.');
  if (String(driver.courier_id) !== String(vehicle.courier_id)) throw new Error('Driver and vehicle must belong to the same courier.');
  if (!sameCourier({ id: driver.courier_id }, targetCourier) || !sameCourier({ id: vehicle.courier_id }, targetCourier)) throw new Error('The selected driver and vehicle must belong to the shipment courier.');

  await assertDriverNotBusy(supabase, driverId, tripId);
  return { courier: targetCourier, driver, vehicle };
}

async function validateVehicleForCourier(supabase, { vehicleId, bookingId, routePlanId, courierId, courier } = {}) {
  const targetCourier = await resolveCourierForAssignment(supabase, { bookingId, routePlanId, courierId, courier });
  if (!targetCourier) throw new Error('The shipment courier could not be identified.');
  const vehicle = await getVehicle(supabase, vehicleId);
  if (!vehicle) throw new Error('Vehicle not found.');
  const vehicleStatusValues = [vehicle.status, vehicle.availability, vehicle.assignment_status];
  const vehicleIsAssigned = vehicleStatusValues.some((value) => ['assigned', 'busy', 'in use'].includes(normalize(value)));
  const vehicleHasTrip = vehicleIsAssigned && await vehicleHasActiveTrip(supabase, vehicleId);
  if (!resourceIsAvailable(...vehicleStatusValues) || vehicleHasTrip) throw new Error('Vehicle is not available for assignment.');
  if (!vehicle.courier_id || !sameCourier({ id: vehicle.courier_id }, targetCourier)) throw new Error('The selected vehicle must belong to the shipment courier.');
  return { courier: targetCourier, vehicle };
}

async function listEligibleDrivers(supabase, { courierId, courier, excludingTripId } = {}) {
  const targetCourier = await resolveCourierForAssignment(supabase, { courierId, courier });
  if (!targetCourier) return [];
  const { data: drivers, error } = await supabase.from('users').select('id, email, full_name, role, is_active, courier_id').eq('role', 'driver').eq('courier_id', targetCourier.id).eq('is_active', true);
  if (error) throw error;
  const eligible = [];
  for (const driver of drivers || []) {
    if (!isAvailable(getDriverAvailability(driver))) continue;
    try {
      await assertDriverNotBusy(supabase, driver.id, excludingTripId);
      eligible.push(driver);
    } catch (error) {
      if (!/already assigned/i.test(error.message)) throw error;
    }
  }
  return eligible;
}

module.exports = { validateAssignment, validateVehicleForCourier, listEligibleDrivers, resolveCourierForAssignment, isAvailable, isActiveTripStatus };
