"use client";

import { startTransition, useEffect, useState } from "react";
import { getBookings, getDrivers, getVehicles, getParcels, getTrips } from "./api";
import {
  Booking,
  CourierName,
  Driver,
  HUB_POS,
  Parcel,
  DispatchState,
  RoutePlanPoint,
  Vehicle,
} from "./parcelTypes";

const CHANGE_EVENT = "vrds-parcel-store-change";

type StoreState = {
  parcels: Parcel[];
  bookings: Booking[];
  drivers: Driver[];
  vehicles: Vehicle[];
};

const DEFAULT_STATE: StoreState = {
  parcels: [],
  bookings: [],
  drivers: [],
  vehicles: [],
};

let state: StoreState = DEFAULT_STATE;

function stringOrUndefined(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const result = String(value).trim();
  return result || undefined;
}

function numberOrNull(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNumberOrNull(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function routePlanOrNull(value: unknown): Booking["routePlan"] {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as NonNullable<Booking["routePlan"]>
    : null;
}

function parseBookingStatus(value: unknown): Booking["status"] {
  const status = String(value || "PENDING").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["dispatched", "in_transit", "delivering", "completed"].includes(status)) return "DISPATCHED";
  if (status === "cancelled" || status === "canceled") return "CANCELLED";
  if (["driver_vehicle_assigned", "assigned", "driver_assigned", "vehicle_assigned", "ready"].includes(status)) {
    return "DRIVER_VEHICLE_ASSIGNED";
  }
  return "PENDING";
}

function normalizeDispatch(value: unknown): DispatchState | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const position = record.currentPos;
  if (typeof record.status !== "string" || typeof record.progress !== "number"
    || !Number.isFinite(record.progress) || typeof record.etaMinutes !== "number"
    || !Number.isFinite(record.etaMinutes) || typeof position !== "object" || position === null || Array.isArray(position)
    || !("lat" in position) || !("lng" in position)) return undefined;
  const currentPos = position as { lat: unknown; lng: unknown };
  const lat = Number(currentPos.lat);
  const lng = Number(currentPos.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  let status: DispatchState["status"];
  switch (record.status) {
    case "PICKUP_ASSIGNED":
    case "READY":
    case "DELIVERING":
    case "COMPLETED":
      status = record.status;
      break;
    default:
      return undefined;
  }
  return {
    status,
    progress: record.progress,
    etaMinutes: record.etaMinutes,
    currentPos: { lat, lng },
  };
}

function normalizeDeliveryDestinations(value: unknown): RoutePlanPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): RoutePlanPoint[] => {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return [];
    const point = candidate as Record<string, unknown>;
    const normalized: RoutePlanPoint = {};
    for (const key of ["id", "name", "address", "purpose", "kind", "arrival", "departure", "instructions", "parcelReference"] as const) {
      if (typeof point[key] === "string") normalized[key] = point[key];
    }
    for (const key of ["lat", "lng", "latitude", "longitude"] as const) {
      const coordinate = point[key];
      if (coordinate === null || typeof coordinate === "string" || typeof coordinate === "number") normalized[key] = coordinate;
    }
    if (typeof point.durationMinutes === "number" && Number.isFinite(point.durationMinutes)) {
      normalized.durationMinutes = point.durationMinutes;
    }
    if (Array.isArray(point.parcelEvents)) {
      normalized.parcelEvents = point.parcelEvents.flatMap((event) => {
        if (typeof event !== "object" || event === null || Array.isArray(event)) return [];
        const parcelEvent = event as Record<string, unknown>;
        if (typeof parcelEvent.parcelId !== "string" || typeof parcelEvent.trackingNumber !== "string"
          || (parcelEvent.kind !== "pickup" && parcelEvent.kind !== "delivery")) return [];
        return [{ parcelId: parcelEvent.parcelId, trackingNumber: parcelEvent.trackingNumber, kind: parcelEvent.kind }];
      });
    }
    return [normalized];
  });
}

function extractParcelIdsFromCargoDescription(cargoDescription?: string | null): string[] {
  if (!cargoDescription) return [];

  const match = String(cargoDescription).match(/parcel_ids\s*=\s*([^;]+)/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((id) => String(id).trim())
    .filter(Boolean);
}

function normalizeBookingParcelIds(booking: Record<string, unknown>, fallbackIds: string[] = []): string[] {
  const explicitIds = Array.isArray(booking.parcel_ids)
    ? booking.parcel_ids
    : Array.isArray(booking.parcelIds)
    ? booking.parcelIds
    : [];

  const idsToUse = explicitIds.length ? explicitIds : fallbackIds;
  return Array.from(new Set(idsToUse.map((id: unknown) => String(id).trim()).filter(Boolean)));
}

function bookingSignature(booking: Pick<Booking, "id" | "routePlanId" | "parcelIds">) {
  const parcelIds = Array.isArray(booking.parcelIds)
    ? booking.parcelIds.map((id) => String(id)).filter(Boolean).sort()
    : [];

  if (booking.routePlanId) {
    return `route:${String(booking.routePlanId)}`;
  }

  if (parcelIds.length > 0) {
    return `parcels:${parcelIds.join("|")}`;
  }

  return `id:${booking.id}`;
}

function dedupeBookings(bookings: Booking[]) {
  const byKey = new Map<string, Booking>();

  for (const booking of bookings) {
    const normalizedParcelIds = Array.from(new Set((booking.parcelIds || []).map((id) => String(id)).filter(Boolean)));
    const candidateKey = bookingSignature({ ...booking, parcelIds: normalizedParcelIds });
    const existing = byKey.get(candidateKey);

    if (!existing) {
      byKey.set(candidateKey, booking);
      continue;
    }

    const existingParcelIds = new Set((existing.parcelIds || []).map((id) => String(id)));
    const candidateParcelIds = new Set(normalizedParcelIds);
    const hasSharedParcel = [...candidateParcelIds].some((id) => existingParcelIds.has(id));
    const sameRoutePlan = Boolean(existing.routePlanId && booking.routePlanId && String(existing.routePlanId) === String(booking.routePlanId));

    if (!hasSharedParcel && !sameRoutePlan) {
      byKey.set(`${candidateKey}-alt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, booking);
      continue;
    }

    const candidate = new Date(booking.createdAt).getTime() >= new Date(existing.createdAt).getTime() ? booking : existing;
    byKey.set(candidateKey, {
      ...existing,
      ...candidate,
      parcelIds: Array.from(new Set([...(existing.parcelIds || []), ...(candidate.parcelIds || [])].map((id) => String(id)))),
      routePlanId: candidate.routePlanId || existing.routePlanId,
      routeLabel: candidate.routeLabel || existing.routeLabel,
      totalWeightKg: Number(candidate.totalWeightKg || existing.totalWeightKg || 0),
      driverId: candidate.driverId || existing.driverId,
      driverName: candidate.driverName || existing.driverName,
      vehicleId: candidate.vehicleId || existing.vehicleId,
      vehiclePlate: candidate.vehiclePlate || existing.vehiclePlate,
      status: candidate.status || existing.status,
      dispatch: candidate.dispatch || existing.dispatch,
    });
  }

  return Array.from(byKey.values());
}

function writeState(next: StoreState) {
  state = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function addMissingBookedParcels(parcels: Parcel[], bookings: Booking[]) {
  const existingIds = new Set(parcels.map((parcel) => String(parcel.id)));
  const missing: Parcel[] = [];

  for (const booking of bookings) {
    const knownParcelIds = (booking.parcelIds || []).map((parcelId) => String(parcelId));
    const declaredCount = Number(booking.parcelCount || 0);
    const expectedCount = Math.max(knownParcelIds.length, declaredCount);
    const manifestIds = [...knownParcelIds];

    for (let index = manifestIds.length; index < expectedCount; index += 1) {
      manifestIds.push(`${booking.id}-manifest-${index + 1}`);
    }

    for (const parcelId of manifestIds) {
      const id = String(parcelId);
      if (!id || existingIds.has(id)) continue;

      missing.push({
        id,
        trackingNumber: `MANIFEST-${id}`,
        senderName: "Booking manifest",
        senderPhone: "",
        recipientName: "Pending parcel record",
        recipientPhone: "",
        destinationAddress: booking.routeLabel || "Destination pending synchronization",
        destLat: 0,
        destLng: 0,
        parcelType: "E-commerce Package",
        courier: (normalizeCourierName(booking.courier) ?? "Airship Express") as CourierName,
        weightKg: 0,
        status: "BOOKED",
        receivedAt: booking.createdAt,
        bookingId: booking.id,
        routePlanId: booking.routePlanId,
        notes: "Manifest record pending synchronization with the parcels table.",
      });
      existingIds.add(id);
    }
  }

  return missing.length ? [...parcels, ...missing] : parcels;
}

function normalizeCourierName(raw: unknown): CourierName | undefined {
  if (raw === null || raw === undefined) return undefined;
  return /airship/i.test(String(raw)) ? "Airship Express" : undefined;
}

function normalizeStatusToAvailability(raw: unknown, defaultAvailable = true): 'Available' | 'Assigned' {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return defaultAvailable ? 'Available' : 'Assigned';
  if (/\b(assigned|busy|in transit|dispatched|delivering|on trip|on duty|in use|occupied|unavailable|maintenance|out of service|offline)\b/.test(value)) {
    return 'Assigned';
  }
  if (/\b(available|idle|ready|free|standby|active|open|available for dispatch)\b/.test(value)) {
    return 'Available';
  }
  return defaultAvailable ? 'Available' : 'Assigned';
}

function normalizeParcelStatus(raw: unknown, parcel?: Record<string, unknown>): Parcel["status"] {
  const value = String(raw ?? "received").trim().toLowerCase().replace(/\s+/g, "_");
  const hasBookingAssignment = Boolean(
    parcel?.booking_id ?? parcel?.bookingId ?? parcel?.route_plan_id ?? parcel?.routePlanId
  );

  if (hasBookingAssignment && ["picked_up", "received", "pending", "ready"].includes(value)) {
    return "BOOKED";
  }

  const statusMap: Record<string, Parcel["status"]> = {
    received: "PICKED_UP",
    pending: "PICKED_UP",
    ready: "PICKED_UP",
    ready_for_booking: "PICKED_UP",
    picked_up: "PICKED_UP",
    booked: "BOOKED",
    assigned: "BOOKED",
    in_transit: "IN_TRANSIT",
    delayed: "DELAYED",
    late: "DELAYED",
    exception: "DELAYED",
    delivered: "DELIVERED",
    cancelled: "CANCELLED",
    canceled: "CANCELLED",
  };
  return statusMap[value] ?? "PICKED_UP";
}

function isTripInTransitStatus(raw: unknown) {
  const value = String(raw ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  return /\b(accepted|scheduled|in transit|transit|dispatched|dispatch|delivering|moving|en route|on route)\b/.test(value);
}

function isTripBookedStatus(raw: unknown) {
  const value = String(raw ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  return /\b(assigned|scheduled|pending|accepted|driver assigned)\b/.test(value);
}

function isTripDelayedStatus(raw: unknown) {
  const value = String(raw ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  return /\b(delayed|late|behind schedule)\b/.test(value);
}

function applyTripStatuses(parcels: Parcel[], trips: Record<string, unknown>[] | null) {
  if (!Array.isArray(trips) || trips.length === 0) return parcels;

  const delayedBookingIds = new Set(
    trips
      .filter((trip) => isTripDelayedStatus(trip.status))
      .map((trip) => String(trip.booking_id ?? trip.bookingId ?? ""))
      .filter(Boolean)
  );
  const delayedTripIds = new Set(
    trips
      .filter((trip) => isTripDelayedStatus(trip.status))
      .map((trip) => String(trip.id ?? trip.trip_id ?? ""))
      .filter(Boolean)
  );
  const bookedBookingIds = new Set(
    trips
      .filter((trip) => isTripBookedStatus(trip.status))
      .map((trip) => String(trip.booking_id ?? trip.bookingId ?? ""))
      .filter(Boolean)
  );
  const bookedTripIds = new Set(
    trips
      .filter((trip) => isTripBookedStatus(trip.status))
      .map((trip) => String(trip.id ?? trip.trip_id ?? ""))
      .filter(Boolean)
  );

  const activeBookingIds = new Set(
    trips
      .filter((trip) => isTripInTransitStatus(trip.status))
      .map((trip) => String(trip.booking_id ?? trip.bookingId ?? ""))
      .filter(Boolean)
  );
  const activeTripIds = new Set(
    trips
      .filter((trip) => isTripInTransitStatus(trip.status))
      .map((trip) => String(trip.id ?? trip.trip_id ?? ""))
      .filter(Boolean)
  );

  return parcels.map((parcel) =>
    (delayedBookingIds.has(String(parcel.bookingId ?? "")) || delayedTripIds.has(String(parcel.tripId ?? "")))
      ? { ...parcel, status: "DELAYED" as const }
      : (activeBookingIds.has(String(parcel.bookingId ?? "")) || activeTripIds.has(String(parcel.tripId ?? "")))
      ? { ...parcel, status: "IN_TRANSIT" as const }
      : (bookedBookingIds.has(String(parcel.bookingId ?? "")) || bookedTripIds.has(String(parcel.tripId ?? "")))
      ? { ...parcel, status: "BOOKED" as const }
      : parcel
  );
}

export function useParcelStore(options: { status?: string; history?: boolean } = {}) {
  const [snapshot, setSnapshot] = useState<StoreState>(
    options.status ? { ...state, parcels: [] } : state
  );
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setSnapshot(options.status ? { ...state, parcels: [] } : { ...state });
    startTransition(() => {
      sync();
      setReady(true);
    });

    // hydrate from backend APIs if available
    (async function hydrateFromApi() {
      try {
        const [apiBookings, apiDrivers, apiVehicles, apiParcels, apiTrips] = await Promise.all([
          getBookings().catch(() => null),
          getDrivers().catch(() => null),
          getVehicles().catch(() => null),
          getParcels(options).catch(() => null),
          getTrips({ light: true }).catch(() => null),
        ]);
        const sourceErrors = [
          apiBookings === null ? "Bookings" : null,
          apiDrivers === null ? "Drivers" : null,
          apiVehicles === null ? "Vehicles" : null,
          apiParcels === null ? "Parcels" : null,
          apiTrips === null ? "Trips" : null,
        ].filter((source): source is string => Boolean(source));
        setLoadError(sourceErrors.length ? `Unable to refresh ${sourceErrors.join(", ")}. Showing last available records.` : null);

        const normalizedBookings = apiBookings === null
          ? []
          : Array.isArray(apiBookings)
          ? apiBookings.map((booking: Record<string, unknown>) => {
              const cargoDescription = String(booking.cargo_description || "");
              const parcelCount = Number(cargoDescription.match(/(\d+)\s+parcel/i)?.[1] || 0);
              const storedParcelIds = extractParcelIdsFromCargoDescription(
                typeof booking.cargo_description === "string" ? booking.cargo_description : null
              );
              const finalParcelIds = normalizeBookingParcelIds(booking, storedParcelIds);

              if (!finalParcelIds.length && booking.id && parcelCount > 0) {
                console.log('[hydrateFromApi] WARNING - parcelIds empty but parcelCount > 0:', {
                  bookingId: booking.id,
                  cargoDescription,
                  parcelCount,
                  storedParcelIds,
                  'booking.parcel_ids': booking.parcel_ids,
                  'booking.parcelIds': booking.parcelIds,
                });
              }

              return {
                id: String(booking.id),
                parcelIds: finalParcelIds,
                courier: stringOrUndefined(booking.courier),
                courierId: stringOrUndefined(booking.courier_id ?? booking.courierId),
                routePlanId: stringOrUndefined(booking.route_plan_id ?? booking.routePlanId),
                routePlan: routePlanOrNull(booking.routePlan ?? booking.route_plan),
                routeLabel: String(booking.route_label || booking.routeLabel || [booking.pickup_location, booking.dropoff_location].filter(Boolean).join(" → ") || `Booking ${booking.id}`),
                totalWeightKg: Number(booking.total_weight_kg ?? booking.totalWeightKg ?? booking.load_kg ?? booking.cargo_weight ?? 0),
                parcelCount,
                createdAt: String(booking.created_at || booking.createdAt || new Date().toISOString()),
                status: parseBookingStatus(booking.status || booking.booking_status),
                driverId: stringOrUndefined(booking.driver_id || booking.driverId),
                driverName: stringOrUndefined(booking.driver_name || booking.driverName),
                vehicleId: stringOrUndefined(booking.vehicle_id || booking.vehicleId),
                vehiclePlate: stringOrUndefined(booking.vehicle_plate || booking.vehiclePlate),
                dispatch: normalizeDispatch(booking.dispatch),
                // expose coordinates and destinations if backend provides them
                pickupLatitude: numberOrNull(booking.pickup_latitude ?? booking.pickupLatitude),
                pickupLongitude: numberOrNull(booking.pickup_longitude ?? booking.pickupLongitude),
                dropoffLatitude: stringOrNumberOrNull(booking.dropoff_latitude ?? booking.dropoffLatitude),
                dropoffLongitude: stringOrNumberOrNull(booking.dropoff_longitude ?? booking.dropoffLongitude),
                deliveryDestinations: normalizeDeliveryDestinations(booking.delivery_destinations ?? booking.deliveryDestinations),
              };
            })
          : [];

        const assignedDriverIds = new Set(
          normalizedBookings
            .filter((booking) => booking.driverId)
            .map((booking) => String(booking.driverId))
        );
        const assignedVehicleIds = new Set(
          normalizedBookings
            .filter((booking) => booking.vehicleId)
            .map((booking) => String(booking.vehicleId))
        );

        const normalizedDrivers = Array.isArray(apiDrivers)
          ? apiDrivers.map((driver: Record<string, unknown>) => {
              const id = String(driver.id);
              return {
                id,
                name: String(driver.full_name || driver.name || driver.email || `Driver ${driver.id}`),
                vehicleId: stringOrUndefined(driver.vehicle_id || driver.vehicleId),
                courierId: stringOrUndefined(driver.courier_id || driver.courierId),
                courier: stringOrUndefined(driver.courier || driver.courier_name || driver.courierName),
                status: assignedDriverIds.has(id)
                  ? 'Assigned'
                  : normalizeStatusToAvailability(
                      driver.status || driver.current_status || driver.state || (driver.vehicle_id ? 'Assigned' : 'Available')
                    ),
              };
            })
          : [];

        const normalizedVehicles = Array.isArray(apiVehicles)
          ? apiVehicles.map((vehicle: Record<string, unknown>) => {
              const id = String(vehicle.id);
              return {
                id,
                courierId: stringOrUndefined(vehicle.courier_id || vehicle.courierId),
                courier: normalizeCourierName(vehicle.courier || vehicle.courier_name || vehicle.courierName),
                plate: String(vehicle.plate_number || vehicle.plate || vehicle.plateNumber || `VEH-${vehicle.id}`),
                type: String(vehicle.vehicle_type || vehicle.type || vehicle.vehicleType || 'Unknown'),
                capacityKg: Number(vehicle.capacity_kg ?? vehicle.capacity ?? vehicle.capacityKg ?? 0),
                fuelEfficiencyKmPerL: Number(vehicle.fuel_efficiency ?? vehicle.fuelEfficiency) || null,
                status: assignedVehicleIds.has(id)
                  ? 'Assigned'
                  : normalizeStatusToAvailability(vehicle.status || vehicle.vehicle_status || vehicle.state || 'Available'),
              };
            })
          : [];

        const finalDrivers = normalizedDrivers.length > 0 ? normalizedDrivers : [];
        const finalVehicles = normalizedVehicles.length > 0 ? normalizedVehicles : [];

        const normalizedParcels = Array.isArray(apiParcels)
          ? apiParcels.map((p: Record<string, unknown>): Parcel => ({
              id: String(p.id),
              trackingNumber: String(p.tracking_number || p.trackingNumber || makeId("AXP")),
              senderName: String(p.customer_name || p.sender_name || p.senderName || "Customer"),
              senderPhone: String(p.customer_phone || p.customerPhone || p.sender_phone || p.senderPhone || ""),
              recipientName: String(p.recipient_name || p.recipientName || p.customer_name || "Customer"),
              recipientPhone: String(p.recipient_phone || p.recipientPhone || ""),
              destinationAddress:
                String(p.dropoff_location || p.dropoffLocation || p.destination || p.delivery_address || p.deliveryAddress || p.address || p.pickup_location || p.pickupLocation || ""),
              bulk_qr_code: stringOrUndefined(p.bulk_qr_code ?? p.qr_code ?? p.bulk_qr ?? p.bulkQrCode ?? p.qrCode),
              bulkQrCode: stringOrUndefined(p.bulk_qr_code ?? p.qr_code ?? p.bulk_qr ?? p.bulkQrCode ?? p.qrCode),
              bulk_parcel_count: Number(p.bulk_parcel_count ?? p.bulkParcelCount ?? 0) || null,
              parcel_count: Number(p.parcel_count ?? p.parcelCount ?? 0) || null,
              package_count: Number(p.package_count ?? p.packageCount ?? 0) || null,
              quantity: Number(p.quantity ?? 0) || null,
              destLat: Number(
                p.dest_lat ?? p.destLat ?? p.dropoff_latitude ?? p.dropoffLatitude ?? p.latitude ?? p.lat ?? 0
              ),
              destLng: Number(
                p.dest_lng ?? p.destLng ?? p.dropoff_longitude ?? p.dropoffLongitude ?? p.longitude ?? p.lng ?? 0
              ),
              parcelType: "E-commerce Package",
              courier:
                normalizeCourierName(
                  p.courier ?? p.courier_name ?? p.courierName ?? p.courier_id ?? p.courierId ?? p.driver_name
                ) ?? undefined,
              weightKg: Number(p.weight_kg ?? p.weightKg ?? p.weight ?? 0),
              notes: stringOrUndefined(p.notes),
              status: normalizeParcelStatus(p.status || p.parcel_status, p),
              receivedAt: String(p.created_at || p.received_at || p.receivedAt || new Date().toISOString()),
              bookingId: stringOrUndefined(p.booking_id || p.bookingId),
              routePlanId: stringOrUndefined(p.route_plan_id || p.routePlanId),
              tripId: stringOrUndefined(p.trip_id || p.tripId),
            }))
          : [];
        const currentParcelsById = new Map(state.parcels.map((parcel) => [parcel.id, parcel]));
        const bookingByParcelId = new Map<string, string>();
        normalizedBookings.forEach((booking) => {
          booking.parcelIds.forEach((parcelId: string | number) => bookingByParcelId.set(String(parcelId), booking.id));
        });
        const mergedParcels = normalizedParcels.map((parcel) => {
          const current = currentParcelsById.get(parcel.id);
          const bookingId = bookingByParcelId.get(String(parcel.id));
          if (bookingId && !parcel.bookingId) {
            parcel = {
              ...parcel,
              bookingId,
              status: parcel.status === "PICKED_UP" ? "BOOKED" : parcel.status,
            };
          }
          if (!current) return parcel;
          if (current.status === parcel.status) return current;
          // Prefer backend/remote parcel status when statuses diverge.
          // This avoids stale local IN_TRANSIT states from masking real booked/received updates.
          return parcel;
        });
        const syncedParcels = applyTripStatuses(
          addMissingBookedParcels(mergedParcels, normalizedBookings),
          apiTrips
        );

        const nextState: StoreState = {
          bookings: apiBookings === null || (Array.isArray(apiBookings) && apiBookings.length === 0) ? state.bookings : dedupeBookings(normalizedBookings),
          drivers: apiDrivers === null ? state.drivers : finalDrivers,
          vehicles: apiVehicles === null ? state.vehicles : finalVehicles,
          parcels: apiParcels === null || (Array.isArray(apiParcels) && apiParcels.length === 0) ? state.parcels : syncedParcels,
        };

        if (options.status) {
          // Filtered consumers, such as route planning, keep their result local
          // so they do not replace the shared store used by other pages.
          startTransition(() => setSnapshot(nextState));
        } else {
          writeState(nextState);
          sync();
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load fleet records.");
      }
    })();

    if (!options.status) {
      window.addEventListener(CHANGE_EVENT, sync);
    }
    return () => {
      if (!options.status) window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  return { ...snapshot, ready, error: loadError };
}

export async function refreshStoreFromBackend(options: { status?: string; history?: boolean } = {}) {
  // Manually re-hydrate the store from backend APIs
  try {
    const [apiBookings, apiDrivers, apiVehicles, apiParcels, apiTrips] = await Promise.all([
      getBookings().catch(() => null),
      getDrivers().catch(() => null),
      getVehicles().catch(() => null),
      getParcels(options).catch(() => null),
      getTrips({ light: true }).catch(() => null),
    ]);

    console.log('[refreshStoreFromBackend] Raw API responses:', {
      bookingsCount: Array.isArray(apiBookings) ? apiBookings.length : 'null/error',
      parcelsCount: Array.isArray(apiParcels) ? apiParcels.length : 'null/error',
    });

    if (Array.isArray(apiBookings) && apiBookings.length > 0) {
      console.log('[refreshStoreFromBackend] Sample bookings:', apiBookings.slice(0, 2).map((b: Record<string, unknown>) => ({
        id: b.id,
        cargo_description: b.cargo_description,
        route_plan_id: b.route_plan_id,
      })));
    }

    if (Array.isArray(apiParcels) && apiParcels.length > 0) {
      console.log('[refreshStoreFromBackend] Parcel statuses:', new Set(apiParcels.map((p: Record<string, unknown>) => p.status)));
      console.log('[refreshStoreFromBackend] Sample parcels:', apiParcels.slice(0, 5).map((p: Record<string, unknown>) => ({
        id: p.id,
        status: p.status,
        booking_id: p.booking_id,
        route_plan_id: p.route_plan_id,
      })));
    }

    const normalizedBookings = apiBookings === null
      ? []
      : Array.isArray(apiBookings)
      ? apiBookings.map((booking: Record<string, unknown>) => {
          const cargoDescription = String(booking.cargo_description || "");
          const parcelCount = Number(cargoDescription.match(/(\d+)\s+parcel/i)?.[1] || 0);
          const storedParcelIds = extractParcelIdsFromCargoDescription(
            typeof booking.cargo_description === "string" ? booking.cargo_description : null
          );
          const finalParcelIds = normalizeBookingParcelIds(booking, storedParcelIds);

          if (!finalParcelIds.length && booking.id && parcelCount > 0) {
            console.log('[refreshStoreFromBackend normalizeBookings] WARNING - parcelIds empty but parcelCount > 0:', {
              bookingId: booking.id,
              cargoDescription,
              parcelCount,
              storedParcelIds,
              'booking.parcel_ids': booking.parcel_ids,
              'booking.parcelIds': booking.parcelIds,
            });
          }

          return {
            id: String(booking.id),
            parcelIds: finalParcelIds,
            courier: stringOrUndefined(booking.courier),
            routePlanId: stringOrUndefined(booking.route_plan_id ?? booking.routePlanId),
            routePlan: routePlanOrNull(booking.routePlan ?? booking.route_plan),
            routeLabel: String(booking.route_label || booking.routeLabel || [booking.pickup_location, booking.dropoff_location].filter(Boolean).join(" → ") || `Booking ${booking.id}`),
            totalWeightKg: Number(booking.total_weight_kg ?? booking.totalWeightKg ?? booking.load_kg ?? booking.cargo_weight ?? 0),
            parcelCount,
            createdAt: String(booking.created_at || booking.createdAt || new Date().toISOString()),
            status: parseBookingStatus(booking.status || booking.booking_status),
            driverId: stringOrUndefined(booking.driver_id || booking.driverId),
            driverName: stringOrUndefined(booking.driver_name || booking.driverName),
            vehicleId: stringOrUndefined(booking.vehicle_id || booking.vehicleId),
            vehiclePlate: stringOrUndefined(booking.vehicle_plate || booking.vehiclePlate),
            dispatch: normalizeDispatch(booking.dispatch),
            pickupLatitude: numberOrNull(booking.pickup_latitude ?? booking.pickupLatitude),
            pickupLongitude: numberOrNull(booking.pickup_longitude ?? booking.pickupLongitude),
            dropoffLatitude: stringOrNumberOrNull(booking.dropoff_latitude ?? booking.dropoffLatitude),
            dropoffLongitude: stringOrNumberOrNull(booking.dropoff_longitude ?? booking.dropoffLongitude),
            deliveryDestinations: normalizeDeliveryDestinations(booking.delivery_destinations ?? booking.deliveryDestinations),
          };
        })
      : [];

    const assignedDriverIds = new Set(
      normalizedBookings
        .filter((booking) => booking.driverId)
        .map((booking) => String(booking.driverId))
    );
    const assignedVehicleIds = new Set(
      normalizedBookings
        .filter((booking) => booking.vehicleId)
        .map((booking) => String(booking.vehicleId))
    );

    const normalizedDrivers = Array.isArray(apiDrivers)
      ? apiDrivers.map((driver: Record<string, unknown>) => {
          const id = String(driver.id);
          return {
            id,
            name: String(driver.full_name || driver.name || driver.email || `Driver ${driver.id}`),
            status: assignedDriverIds.has(id)
              ? 'Assigned'
              : normalizeStatusToAvailability(
                  driver.status || driver.current_status || driver.state || (driver.vehicle_id ? 'Assigned' : 'Available')
                ),
          };
        })
      : [];

    const normalizedVehicles = Array.isArray(apiVehicles)
      ? apiVehicles.map((vehicle: Record<string, unknown>) => {
          const id = String(vehicle.id);
          return {
            id,
            plate: String(vehicle.plate_number || vehicle.plate || vehicle.plateNumber || `VEH-${vehicle.id}`),
            type: String(vehicle.vehicle_type || vehicle.type || vehicle.vehicleType || 'Unknown'),
            capacityKg: Number(vehicle.capacity_kg ?? vehicle.capacity ?? vehicle.capacityKg ?? 0),
            status: assignedVehicleIds.has(id)
              ? 'Assigned'
              : normalizeStatusToAvailability(vehicle.status || vehicle.vehicle_status || vehicle.state || 'Available'),
          };
        })
      : [];

    const finalDrivers = normalizedDrivers.length > 0 ? normalizedDrivers : [];
    const finalVehicles = normalizedVehicles.length > 0 ? normalizedVehicles : [];

    const normalizedParcels = Array.isArray(apiParcels)
      ? apiParcels.map((p: Record<string, unknown>): Parcel => ({
          id: String(p.id),
          trackingNumber: String(p.tracking_number || p.trackingNumber || makeId("AXP")),
          senderName: String(p.customer_name || p.sender_name || p.senderName || "Customer"),
          senderPhone: String(p.customer_phone || p.customerPhone || p.sender_phone || p.senderPhone || ""),
          recipientName: String(p.recipient_name || p.recipientName || p.customer_name || "Customer"),
          recipientPhone: String(p.recipient_phone || p.recipientPhone || ""),
          destinationAddress:
            String(p.dropoff_location || p.dropoffLocation || p.destination || p.delivery_address || p.deliveryAddress || p.address || p.pickup_location || p.pickupLocation || ""),
          bulk_qr_code: stringOrUndefined(p.bulk_qr_code ?? p.qr_code ?? p.bulk_qr ?? p.bulkQrCode ?? p.qrCode),
          bulkQrCode: stringOrUndefined(p.bulk_qr_code ?? p.qr_code ?? p.bulk_qr ?? p.bulkQrCode ?? p.qrCode),
          bulk_parcel_count: Number(p.bulk_parcel_count ?? p.bulkParcelCount ?? 0) || null,
          parcel_count: Number(p.parcel_count ?? p.parcelCount ?? 0) || null,
          package_count: Number(p.package_count ?? p.packageCount ?? 0) || null,
          quantity: Number(p.quantity ?? 0) || null,
          destLat: Number(
            p.dest_lat ?? p.destLat ?? p.dropoff_latitude ?? p.dropoffLatitude ?? p.latitude ?? p.lat ?? 0
          ),
          destLng: Number(
            p.dest_lng ?? p.destLng ?? p.dropoff_longitude ?? p.dropoffLongitude ?? p.longitude ?? p.lng ?? 0
          ),
          parcelType: "E-commerce Package",
          courier:
            normalizeCourierName(
              p.courier ?? p.courier_name ?? p.courierName ?? p.courier_id ?? p.courierId ?? p.driver_name
            ) ?? undefined,
          weightKg: Number(p.weight_kg ?? p.weightKg ?? p.weight ?? 0),
          notes: stringOrUndefined(p.notes),
          status: normalizeParcelStatus(p.status || p.parcel_status, p),
          receivedAt: String(p.created_at || p.received_at || p.receivedAt || new Date().toISOString()),
          bookingId: stringOrUndefined(p.booking_id || p.bookingId),
          routePlanId: stringOrUndefined(p.route_plan_id || p.routePlanId),
          tripId: stringOrUndefined(p.trip_id || p.tripId),
        }))
      : [];

    const bookingByParcelId = new Map<string, string>();
    normalizedBookings.forEach((booking) => {
      booking.parcelIds.forEach((parcelId: string | number) => bookingByParcelId.set(String(parcelId), booking.id));
    });
    const mergedParcels = normalizedParcels.map((parcel) => {
      const bookingId = bookingByParcelId.get(String(parcel.id));
      if (bookingId && !parcel.bookingId) {
        parcel = {
          ...parcel,
          bookingId,
          status: parcel.status === "PICKED_UP" ? "BOOKED" : parcel.status,
        };
      }
      return parcel;
    });
    const syncedParcels = applyTripStatuses(
      addMissingBookedParcels(mergedParcels, normalizedBookings),
      apiTrips
    );

    const nextState: StoreState = {
      bookings: dedupeBookings(normalizedBookings),
      drivers: finalDrivers,
      vehicles: finalVehicles,
      parcels: syncedParcels,
    };

    writeState(nextState);
    console.log('[refreshStoreFromBackend] Store updated:', {
      bookingsCount: nextState.bookings.length,
      parcelsCount: nextState.parcels.length,
      driversCount: nextState.drivers.length,
      vehiclesCount: nextState.vehicles.length,
      parcelsStatuses: new Set(nextState.parcels.map((p) => p.status)),
      bookingParcelCounts: nextState.bookings.map((b) => ({ id: b.id, parcelCount: b.parcelIds?.length || 0 })),
    });
  } catch (err) {
    console.error('[refreshStoreFromBackend] Error:', err);
  }
}

export function receiveParcel(input: Omit<Parcel, "id" | "trackingNumber" | "status" | "receivedAt">) {
  const parcel: Parcel = {
    ...input,
    id: makeId("PAR"),
    trackingNumber: makeId("AXP"),
    courier: input.courier ?? "Airship Express",
    status: "PICKED_UP",
    receivedAt: new Date().toISOString(),
  };
  writeState({ ...state, parcels: [...state.parcels, parcel] });
  return parcel;
}

/** Marks received parcels as booked. Route planning creates the booking record later. */
export function bulkDeliverParcels(parcelIds: string[]) {
  const selected = state.parcels.filter((parcel) => parcelIds.includes(parcel.id));
  const parcels = state.parcels.map((parcel) =>
    parcelIds.includes(parcel.id) ? { ...parcel, status: "PICKED_UP" as const, bookingId: undefined } : parcel
  );
  writeState({ ...state, parcels });
  return selected;
}

/** Creates the Booking queue entry after a delivery route has been confirmed. */
export function createRouteBooking(
  parcelIds: string[],
  routeLabel: string,
  id?: string,
  routePlanId?: string,
  deliveryDestinations?: Array<{ name?: string; label?: string; lat?: number; lng?: number; latitude?: number; longitude?: number; status?: string }>
) {
  const uniqueParcelIds = Array.from(new Set((parcelIds || []).map((id) => String(id)).filter(Boolean)));
  const selected = state.parcels.filter((parcel) => uniqueParcelIds.includes(parcel.id));
  const existingAssignments = new Map<string, string>();

  state.parcels.forEach((parcel) => {
    if (uniqueParcelIds.includes(parcel.id) && parcel.bookingId) {
      existingAssignments.set(parcel.id, parcel.bookingId);
    }
  });

  const booking: Booking = {
    id: id || makeId("BKG"),
    parcelIds: uniqueParcelIds,
    routePlanId,
    deliveryDestinations,
    routeLabel: routeLabel || "Planned delivery route",
    totalWeightKg: selected.reduce((total, parcel) => total + parcel.weightKg, 0),
    createdAt: new Date().toISOString(),
    status: "PENDING",
  };

  const parcels = state.parcels.map((parcel) => {
    if (!uniqueParcelIds.includes(parcel.id)) return parcel;
    const currentBookingId = parcel.bookingId;
    if (currentBookingId && currentBookingId !== booking.id) {
      return parcel;
    }
    return { ...parcel, status: "BOOKED" as const, bookingId: booking.id, routePlanId: routePlanId ?? parcel.routePlanId };
  });

  const bookingKey = bookingSignature(booking);
  const existingBookingIndex = state.bookings.findIndex((item) => {
    const sameId = item.id === booking.id;
    if (sameId) return true;
    const sameBookingKey = bookingSignature(item) === bookingKey;
    const hasParcelOverlap = (item.parcelIds || []).some((parcelId) => uniqueParcelIds.includes(String(parcelId)));
    const sameRoutePlan = Boolean(item.routePlanId && booking.routePlanId && String(item.routePlanId) === String(booking.routePlanId));
    return sameBookingKey || (sameRoutePlan && hasParcelOverlap);
  });

  const bookings = existingBookingIndex >= 0
    ? state.bookings.map((item, index) => {
        if (index !== existingBookingIndex) return item;
        return {
          ...item,
          ...booking,
          parcelIds: Array.from(new Set([...(item.parcelIds || []), ...(booking.parcelIds || [])].map((id) => String(id)))),
          routePlanId: booking.routePlanId || item.routePlanId,
          routeLabel: booking.routeLabel || item.routeLabel,
          totalWeightKg: Number(booking.totalWeightKg || item.totalWeightKg || 0),
        };
      })
    : dedupeBookings([...state.bookings, booking]);

  writeState({ ...state, parcels, bookings });
  return booking;
}

export function assignDriver(bookingId: string, driverId: string) {
  const driver = state.drivers.find((item) => item.id === driverId);
  if (!driver) return;
  const bookings = state.bookings.map((booking) =>
    booking.id === bookingId
      ? { ...booking, driverId, driverName: driver.name, status: booking.vehicleId ? "DRIVER_VEHICLE_ASSIGNED" as const : booking.status }
      : booking
  );
  const drivers = state.drivers.map((item) => item.id === driverId ? { ...item, status: "Assigned" as const } : item);
  writeState({ ...state, bookings, drivers });
}

export function assignVehicle(bookingId: string, vehicleId: string) {
  const vehicle = state.vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) return;
  const bookings = state.bookings.map((booking) =>
    booking.id === bookingId
      ? { ...booking, vehicleId, vehiclePlate: vehicle.plate, status: booking.driverId ? "DRIVER_VEHICLE_ASSIGNED" as const : booking.status }
      : booking
  );
  const vehicles = state.vehicles.map((item) => item.id === vehicleId ? { ...item, status: "Assigned" as const } : item);
  writeState({ ...state, bookings, vehicles });
}

export function assignDriverAndVehicle(bookingId: string, driverId: string, vehicleId: string) {
  const booking = state.bookings.find((item) => item.id === bookingId);
  const driver = state.drivers.find((item) => item.id === driverId);
  const vehicle = state.vehicles.find((item) => item.id === vehicleId);
  if (!booking || !driver || !vehicle) return;

  const bookings = state.bookings.map((item) =>
    item.id === bookingId
      ? {
          ...item,
          driverId: driver.id,
          driverName: driver.name,
          vehicleId: vehicle.id,
          vehiclePlate: vehicle.plate,
          status: "DRIVER_VEHICLE_ASSIGNED" as const,
        }
      : item
  );
  const drivers = state.drivers.map((item) => {
    if (item.id === booking.driverId && item.id !== driver.id) return { ...item, status: "Available" as const };
    if (item.id === driver.id) return { ...item, status: "Assigned" as const };
    return item;
  });
  const vehicles = state.vehicles.map((item) => {
    if (item.id === booking.vehicleId && item.id !== vehicle.id) return { ...item, status: "Available" as const };
    if (item.id === vehicle.id) return { ...item, status: "Assigned" as const };
    return item;
  });

  writeState({ ...state, bookings, drivers, vehicles });
}

export function confirmDispatch(bookingId: string): { ok: boolean; reason?: string } {
  const booking = state.bookings.find((item) => item.id === bookingId);
  if (!booking) return { ok: false, reason: "Booking not found." };
  if (!booking.driverId || !booking.vehicleId) return { ok: false, reason: "Assign a driver and vehicle first." };
  const nextBooking: Booking = {
    ...booking,
    status: "DRIVER_VEHICLE_ASSIGNED",
    dispatch: { status: "PICKUP_ASSIGNED", progress: 0, etaMinutes: 0, currentPos: HUB_POS },
  };
  const bookings = state.bookings.map((item) => item.id === bookingId ? nextBooking : item);
  const parcels = state.parcels.map((parcel) => parcel.bookingId === bookingId ? { ...parcel, status: "BOOKED" as const } : parcel);
  writeState({ ...state, bookings, parcels });
  return { ok: true };
}

export function cancelBooking(bookingId: string) {
  const bookings = state.bookings.map((booking) => booking.id === bookingId ? { ...booking, status: "CANCELLED" as const } : booking);
  const parcels = state.parcels.map((parcel) => parcel.bookingId === bookingId ? { ...parcel, status: "CANCELLED" as const } : parcel);
  writeState({ ...state, bookings, parcels });
}

export function advanceDispatch(bookingId: string) {
  const bookings = state.bookings.map((booking) => {
    if (booking.id !== bookingId || !booking.dispatch) return booking;
    const progress = Math.min(100, booking.dispatch.progress + 30);
    return {
      ...booking,
      dispatch: {
        ...booking.dispatch,
        progress,
        etaMinutes: Math.max(0, booking.dispatch.etaMinutes - 10),
        status: progress >= 100 ? "COMPLETED" as const : "DELIVERING" as const,
      },
    };
  });
  // Reaching 100% in the local dispatch simulation means the route timeline
  // is complete, not that delivery was confirmed. Keep parcels in transit;
  // only an explicit completion/proof-of-delivery action may mark DELIVERED.
  const parcels = state.parcels;
  writeState({ ...state, bookings, parcels });
}
