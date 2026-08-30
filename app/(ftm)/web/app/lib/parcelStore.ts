"use client";

import { useEffect, useState } from "react";
import { getBookings, getDrivers, getVehicles, getParcels } from "./api";
import {
  Booking,
  COURIER_NAMES,
  CourierName,
  Driver,
  HUB_POS,
  Parcel,
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

function extractParcelIdsFromCargoDescription(cargoDescription?: string | null): string[] {
  if (!cargoDescription) return [];

  const match = String(cargoDescription).match(/parcel_ids\s*=\s*([^;]+)/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((id) => String(id).trim())
    .filter(Boolean);
}

function normalizeBookingParcelIds(booking: any, fallbackIds: string[] = []): string[] {
  const explicitIds = Array.isArray(booking.parcel_ids)
    ? booking.parcel_ids
    : Array.isArray(booking.parcelIds)
    ? booking.parcelIds
    : [];

  const idsToUse = explicitIds.length ? explicitIds : fallbackIds;
  return Array.from(new Set(idsToUse.map((id: any) => String(id).trim()).filter(Boolean)));
}

function bookingSignature(booking: Pick<Booking, "id" | "routePlanId" | "parcelIds">) {
  const parcelIds = Array.isArray(booking.parcelIds) ? booking.parcelIds.map((id) => String(id)).sort() : [];
  return booking.routePlanId
    ? `route:${String(booking.routePlanId)}`
    : `parcels:${parcelIds.join("|") || booking.id}`;
}

function dedupeBookings(bookings: Booking[]) {
  const byKey = new Map<string, Booking>();

  for (const booking of bookings) {
    const key = bookingSignature(booking);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, booking);
      continue;
    }

    const candidate = new Date(booking.createdAt).getTime() >= new Date(existing.createdAt).getTime() ? booking : existing;
    byKey.set(key, {
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

const COURIER_CANONICAL_MAP: Record<string, CourierName> = {
  "Shopee Xpress": "ShopeeXpress",
  "ShopeeXpress": "ShopeeXpress",
  "J&T Express": "JNT Express",
  "J&T Cargo": "JNT Express",
  "JNT Express": "JNT Express",
  "Lazada": "Lazada Express",
  "Lazada Express": "Lazada Express",
  "Flash Express": "Flash Express",
  "TikTok Delivery": "TikTok Delivery",
  "LBC Express": "LBC",
  "LBC": "LBC",
  "GOGO Xpress": "GOGO Xpress",
  "Air21": "Airship Express",
  "Airship Express": "Airship Express",
};

function normalizeCourierName(raw: unknown): CourierName | undefined {
  if (raw === null || raw === undefined) return undefined;
  const value = String(raw).trim();
  if (!value) return undefined;
  const normalized = COURIER_CANONICAL_MAP[value];
  if (normalized) return normalized;
  const candidate = COURIER_NAMES.find((name) => name.toLowerCase() === value.toLowerCase());
  if (candidate) return candidate;
  if (value.toLowerCase().includes("j&t")) return "JNT Express";
  if (value.toLowerCase().includes("lazada")) return "Lazada Express";
  if (value.toLowerCase().includes("shopee")) return "ShopeeXpress";
  if (value.toLowerCase().includes("lbc")) return "LBC";
  if (value.toLowerCase().includes("gogo")) return "GOGO Xpress";
  if (value.toLowerCase().includes("flash")) return "Flash Express";
  if (value.toLowerCase().includes("tiktok")) return "TikTok Delivery";
  if (value.toLowerCase().includes("airship")) return "Airship Express";
  return undefined;
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

function normalizeParcelStatus(raw: unknown): Parcel["status"] {
  const value = String(raw ?? "received").trim().toLowerCase().replace(/\s+/g, "_");
  const statusMap: Record<string, Parcel["status"]> = {
    received: "RECEIVED",
    pending: "RECEIVED",
    ready: "RECEIVED",
    ready_for_booking: "RECEIVED",
    picked_up: "BOOKED",
    booked: "BOOKED",
    assigned: "BOOKED",
    in_transit: "IN_TRANSIT",
    delivered: "DELIVERED",
    cancelled: "CANCELLED",
    canceled: "CANCELLED",
  };
  return statusMap[value] ?? "RECEIVED";
}

export function useParcelStore() {
  const [snapshot, setSnapshot] = useState<StoreState>(state);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setSnapshot({ ...state });
    sync();
    setReady(true);

    // hydrate from backend APIs if available
    (async function hydrateFromApi() {
      try {
        const [apiBookings, apiDrivers, apiVehicles, apiParcels] = await Promise.all([
          getBookings().catch(() => null),
          getDrivers().catch(() => null),
          getVehicles().catch(() => null),
          getParcels().catch(() => null),
        ]);

        const normalizedBookings = apiBookings === null
          ? []
          : Array.isArray(apiBookings)
          ? apiBookings.map((booking: any) => {
              const cargoDescription = String(booking.cargo_description || "");
              const parcelCount = Number(cargoDescription.match(/(\d+)\s+parcel/i)?.[1] || 0);
              const storedParcelIds = extractParcelIdsFromCargoDescription(booking.cargo_description);
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
                routePlanId: booking.route_plan_id ?? booking.routePlanId ?? undefined,
                routeLabel: booking.route_label || booking.routeLabel || [booking.pickup_location, booking.dropoff_location].filter(Boolean).join(" → ") || `Booking ${booking.id}`,
                totalWeightKg: Number(booking.total_weight_kg ?? booking.totalWeightKg ?? booking.load_kg ?? booking.cargo_weight ?? 0),
                parcelCount,
                createdAt: booking.created_at || booking.createdAt || new Date().toISOString(),
                status: ["pending", "pending assignment"].includes(String(booking.status || booking.booking_status || "PENDING").toLowerCase())
                  ? "PENDING"
                  : booking.status || booking.booking_status || "PENDING",
                driverId: booking.driver_id || booking.driverId || undefined,
                driverName: booking.driver_name || booking.driverName || undefined,
                vehicleId: booking.vehicle_id || booking.vehicleId || undefined,
                vehiclePlate: booking.vehicle_plate || booking.vehiclePlate || undefined,
                dispatch: booking.dispatch || undefined,
                // expose coordinates and destinations if backend provides them
                pickupLatitude: booking.pickup_latitude ?? booking.pickupLatitude ?? null,
                pickupLongitude: booking.pickup_longitude ?? booking.pickupLongitude ?? null,
                dropoffLatitude: booking.dropoff_latitude ?? booking.dropoffLatitude ?? null,
                dropoffLongitude: booking.dropoff_longitude ?? booking.dropoffLongitude ?? null,
                deliveryDestinations: Array.isArray(booking.delivery_destinations) ? booking.delivery_destinations : (Array.isArray(booking.deliveryDestinations) ? booking.deliveryDestinations : []),
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
          ? apiDrivers.map((driver: any) => {
              const id = String(driver.id);
              return {
                id,
                name: driver.full_name || driver.name || driver.email || `Driver ${driver.id}`,
                status: assignedDriverIds.has(id)
                  ? 'Assigned'
                  : normalizeStatusToAvailability(
                      driver.status || driver.current_status || driver.state || (driver.vehicle_id ? 'Assigned' : 'Available')
                    ),
              };
            })
          : [];

        const normalizedVehicles = Array.isArray(apiVehicles)
          ? apiVehicles.map((vehicle: any) => {
              const id = String(vehicle.id);
              return {
                id,
                plate: vehicle.plate_number || vehicle.plate || vehicle.plateNumber || `VEH-${vehicle.id}`,
                type: vehicle.vehicle_type || vehicle.type || vehicle.vehicleType || 'Unknown',
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
          ? apiParcels.map((p: any): Parcel => ({
              id: String(p.id),
              trackingNumber: p.tracking_number || p.trackingNumber || makeId("AXP"),
              senderName: p.customer_name || p.sender_name || p.senderName || "Customer",
              senderPhone: p.customer_phone || p.customerPhone || p.sender_phone || p.senderPhone || "",
              recipientName: p.recipient_name || p.recipientName || p.customer_name || "Customer",
              recipientPhone: p.recipient_phone || p.recipientPhone || "",
              destinationAddress:
                p.dropoff_location || p.dropoffLocation || p.destination || p.delivery_address || p.deliveryAddress || p.address || p.pickup_location || p.pickupLocation || "",
              bulk_qr_code: p.bulk_qr_code ?? p.qr_code ?? p.bulk_qr ?? p.bulkQrCode ?? p.qrCode ?? undefined,
              bulkQrCode: p.bulk_qr_code ?? p.qr_code ?? p.bulk_qr ?? p.bulkQrCode ?? p.qrCode ?? undefined,
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
              notes: p.notes ?? undefined,
              status: normalizeParcelStatus(p.status || p.parcel_status),
              receivedAt: p.created_at || p.received_at || p.receivedAt || new Date().toISOString(),
              bookingId: p.booking_id || p.bookingId || undefined,
              routePlanId: p.route_plan_id || p.routePlanId || undefined,
              tripId: p.trip_id || p.tripId || undefined,
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
          if (bookingId && !parcel.bookingId) parcel = { ...parcel, bookingId };
          if (!current) return parcel;
          if (current.status === parcel.status) return current;
          // Prefer backend/remote parcel status when statuses diverge.
          // This avoids stale local IN_TRANSIT states from masking real booked/received updates.
          return parcel;
        });

        const nextState: StoreState = {
          bookings: Array.isArray(apiBookings) && apiBookings.length === 0 ? state.bookings : dedupeBookings(normalizedBookings),
          drivers: finalDrivers,
          vehicles: finalVehicles,
          parcels: Array.isArray(apiParcels) && apiParcels.length === 0 ? state.parcels : mergedParcels,
        };

        writeState(nextState);
        sync();
      } catch (e) {
        // silently ignore hydrate errors in client
      }
    })();

    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  return { ...snapshot, ready };
}

export async function refreshStoreFromBackend() {
  // Manually re-hydrate the store from backend APIs
  try {
    const [apiBookings, apiDrivers, apiVehicles, apiParcels] = await Promise.all([
      getBookings().catch(() => null),
      getDrivers().catch(() => null),
      getVehicles().catch(() => null),
      getParcels().catch(() => null),
    ]);

    console.log('[refreshStoreFromBackend] Raw API responses:', {
      bookingsCount: Array.isArray(apiBookings) ? apiBookings.length : 'null/error',
      parcelsCount: Array.isArray(apiParcels) ? apiParcels.length : 'null/error',
    });

    if (Array.isArray(apiBookings) && apiBookings.length > 0) {
      console.log('[refreshStoreFromBackend] Sample bookings:', apiBookings.slice(0, 2).map((b: any) => ({
        id: b.id,
        cargo_description: b.cargo_description,
        route_plan_id: b.route_plan_id,
      })));
    }

    if (Array.isArray(apiParcels) && apiParcels.length > 0) {
      console.log('[refreshStoreFromBackend] Parcel statuses:', new Set(apiParcels.map((p: any) => p.status)));
      console.log('[refreshStoreFromBackend] Sample parcels:', apiParcels.slice(0, 5).map((p: any) => ({
        id: p.id,
        status: p.status,
        booking_id: p.booking_id,
        route_plan_id: p.route_plan_id,
      })));
    }

    const normalizedBookings = apiBookings === null
      ? []
      : Array.isArray(apiBookings)
      ? apiBookings.map((booking: any) => {
          const cargoDescription = String(booking.cargo_description || "");
          const parcelCount = Number(cargoDescription.match(/(\d+)\s+parcel/i)?.[1] || 0);
          const storedParcelIds = extractParcelIdsFromCargoDescription(booking.cargo_description);
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
            routePlanId: booking.route_plan_id ?? booking.routePlanId ?? undefined,
            routeLabel: booking.route_label || booking.routeLabel || [booking.pickup_location, booking.dropoff_location].filter(Boolean).join(" → ") || `Booking ${booking.id}`,
            totalWeightKg: Number(booking.total_weight_kg ?? booking.totalWeightKg ?? booking.load_kg ?? booking.cargo_weight ?? 0),
            parcelCount,
            createdAt: booking.created_at || booking.createdAt || new Date().toISOString(),
            status: ["pending", "pending assignment"].includes(String(booking.status || booking.booking_status || "PENDING").toLowerCase())
              ? "PENDING"
              : booking.status || booking.booking_status || "PENDING",
            driverId: booking.driver_id || booking.driverId || undefined,
            driverName: booking.driver_name || booking.driverName || undefined,
            vehicleId: booking.vehicle_id || booking.vehicleId || undefined,
            vehiclePlate: booking.vehicle_plate || booking.vehiclePlate || undefined,
            dispatch: booking.dispatch || undefined,
            pickupLatitude: booking.pickup_latitude ?? booking.pickupLatitude ?? null,
            pickupLongitude: booking.pickup_longitude ?? booking.pickupLongitude ?? null,
            dropoffLatitude: booking.dropoff_latitude ?? booking.dropoffLatitude ?? null,
            dropoffLongitude: booking.dropoff_longitude ?? booking.dropoffLongitude ?? null,
            deliveryDestinations: Array.isArray(booking.delivery_destinations) ? booking.delivery_destinations : (Array.isArray(booking.deliveryDestinations) ? booking.deliveryDestinations : []),
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
      ? apiDrivers.map((driver: any) => {
          const id = String(driver.id);
          return {
            id,
            name: driver.full_name || driver.name || driver.email || `Driver ${driver.id}`,
            status: assignedDriverIds.has(id)
              ? 'Assigned'
              : normalizeStatusToAvailability(
                  driver.status || driver.current_status || driver.state || (driver.vehicle_id ? 'Assigned' : 'Available')
                ),
          };
        })
      : [];

    const normalizedVehicles = Array.isArray(apiVehicles)
      ? apiVehicles.map((vehicle: any) => {
          const id = String(vehicle.id);
          return {
            id,
            plate: vehicle.plate_number || vehicle.plate || vehicle.plateNumber || `VEH-${vehicle.id}`,
            type: vehicle.vehicle_type || vehicle.type || vehicle.vehicleType || 'Unknown',
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
      ? apiParcels.map((p: any): Parcel => ({
          id: String(p.id),
          trackingNumber: p.tracking_number || p.trackingNumber || makeId("AXP"),
          senderName: p.customer_name || p.sender_name || p.senderName || "Customer",
          senderPhone: p.customer_phone || p.customerPhone || p.sender_phone || p.senderPhone || "",
          recipientName: p.recipient_name || p.recipientName || p.customer_name || "Customer",
          recipientPhone: p.recipient_phone || p.recipientPhone || "",
          destinationAddress:
            p.dropoff_location || p.dropoffLocation || p.destination || p.delivery_address || p.deliveryAddress || p.address || p.pickup_location || p.pickupLocation || "",
          bulk_qr_code: p.bulk_qr_code ?? p.qr_code ?? p.bulk_qr ?? p.bulkQrCode ?? p.qrCode ?? undefined,
          bulkQrCode: p.bulk_qr_code ?? p.qr_code ?? p.bulk_qr ?? p.bulkQrCode ?? p.qrCode ?? undefined,
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
          notes: p.notes ?? undefined,
          status: normalizeParcelStatus(p.status || p.parcel_status),
          receivedAt: p.created_at || p.received_at || p.receivedAt || new Date().toISOString(),
          bookingId: p.booking_id || p.bookingId || undefined,
          routePlanId: p.route_plan_id || p.routePlanId || undefined,
          tripId: p.trip_id || p.tripId || undefined,
        }))
      : [];

    const bookingByParcelId = new Map<string, string>();
    normalizedBookings.forEach((booking) => {
      booking.parcelIds.forEach((parcelId: string | number) => bookingByParcelId.set(String(parcelId), booking.id));
    });
    const mergedParcels = normalizedParcels.map((parcel) => {
      const bookingId = bookingByParcelId.get(String(parcel.id));
      if (bookingId && !parcel.bookingId) parcel = { ...parcel, bookingId };
      return parcel;
    });

    const nextState: StoreState = {
      bookings: dedupeBookings(normalizedBookings),
      drivers: finalDrivers,
      vehicles: finalVehicles,
      parcels: mergedParcels,
    };

    writeState(nextState);
    console.log('[refreshStoreFromBackend] Store updated:', {
      bookingsCount: nextState.bookings.length,
      parcelsCount: nextState.parcels.length,
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
    courier: input.courier ?? "LBC",
    status: "RECEIVED",
    receivedAt: new Date().toISOString(),
  };
  writeState({ ...state, parcels: [...state.parcels, parcel] });
  return parcel;
}

/** Marks received parcels as booked. Route planning creates the booking record later. */
export function bulkDeliverParcels(parcelIds: string[]) {
  const selected = state.parcels.filter((parcel) => parcelIds.includes(parcel.id));
  const parcels = state.parcels.map((parcel) =>
    parcelIds.includes(parcel.id) ? { ...parcel, status: "BOOKED" as const, bookingId: undefined } : parcel
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
  const selected = state.parcels.filter((parcel) => parcelIds.includes(parcel.id));
  const booking: Booking = {
    id: id || makeId("BKG"),
    parcelIds,
    routePlanId,
    deliveryDestinations,
    routeLabel: routeLabel || "Planned delivery route",
    totalWeightKg: selected.reduce((total, parcel) => total + parcel.weightKg, 0),
    createdAt: new Date().toISOString(),
    status: "PENDING",
  };
  const parcels = state.parcels.map((parcel) =>
    parcelIds.includes(parcel.id)
      ? { ...parcel, status: "BOOKED" as const, bookingId: booking.id, routePlanId: routePlanId ?? parcel.routePlanId }
      : parcel
  );

  const bookingKey = bookingSignature(booking);
  const existingBookingIndex = state.bookings.findIndex((item) => bookingSignature(item) === bookingKey || item.id === booking.id);
  const bookings = existingBookingIndex >= 0
    ? state.bookings.map((item, index) => index === existingBookingIndex ? { ...item, ...booking, parcelIds: Array.from(new Set([...(item.parcelIds || []), ...(booking.parcelIds || [])].map((id) => String(id)))) } : item)
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
    status: "DISPATCHED",
    dispatch: { status: "DELIVERING", progress: 10, etaMinutes: 35, currentPos: HUB_POS },
  };
  const bookings = state.bookings.map((item) => item.id === bookingId ? nextBooking : item);
  const parcels = state.parcels.map((parcel) => parcel.bookingId === bookingId ? { ...parcel, status: "IN_TRANSIT" as const } : parcel);
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
  const completed = bookings.find((booking) => booking.id === bookingId)?.dispatch?.status === "COMPLETED";
  const parcels = completed
    ? state.parcels.map((parcel) => parcel.bookingId === bookingId ? { ...parcel, status: "DELIVERED" as const } : parcel)
    : state.parcels;
  writeState({ ...state, bookings, parcels });
}
