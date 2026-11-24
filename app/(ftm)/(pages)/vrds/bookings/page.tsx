"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, PanelLeftOpen, RefreshCw, Truck, UserRound, X } from "lucide-react";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import GlobalFooter from "../../../components/global/GlobalFooter";
import { SkeletonTable } from "../../../components/global/PageSkeleton";
import {
  useParcelStore,
  assignDriver,
  assignVehicle,
  assignDriverAndVehicle,
  confirmDispatch,
} from "../../../lib/parcelStore";
import { Booking, BOOKING_STATUS_LABEL, Parcel, RoutePlanPoint } from "../../../lib/parcelTypes";
import { assignBookingResources, createTrip, fetchJson, getRoutePlan } from "../../../lib/api";

type ResourceRecord = Record<string, unknown> & { id: string };
type AssignmentTripRecord = {
  driver_id?: string | null;
  driverId?: string | null;
  vehicle_id?: string | null;
  vehicleId?: string | null;
  status?: string | null;
};
type ResourceCategory = "vehicles" | "drivers";
type ResourceStatus = "Available" | "Assigned" | "In Use" | "Unavailable";

const RESOURCE_STATUSES: ResourceStatus[] = ["Available", "Assigned", "In Use", "Unavailable"];
const ACTIVE_TRIP_STATUSES = new Set([
  "assigned", "accepted", "pickup assigned", "pickup confirmed", "driver assigned", "vehicle assigned",
  "scheduled", "dispatching", "dispatched", "in transit", "delivering", "en route", "active", "moving", "delayed", "late",
]);

function isActiveTripStatus(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return ACTIVE_TRIP_STATUSES.has(normalized);
}

function resourceValue(resource: ResourceRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = resource[key];
    if (value != null && String(value).trim()) return value;
  }
  return null;
}

function resourceDisplayValue(value: unknown) {
  return value == null || value === "" ? "Not recorded" : String(value);
}

function resourceStatus(resource: ResourceRecord, category: ResourceCategory, bookings: Booking[], trips: AssignmentTripRecord[] = []): ResourceStatus {
  const statusValues = [resource.status, resource.availability, resource.assignment_status, resource.state]
    .filter(Boolean).map((value) => String(value).trim().toLowerCase().replace(/[_-]+/g, " "));
  if ((category === "drivers" && resource.is_active === false) || statusValues.some((value) => /unavailable|inactive|maintenance|out of service|disabled/.test(value))) return "Unavailable";
  const activeTrip = trips.find((trip) => {
    const tripResourceId = category === "drivers" ? trip.driver_id || trip.driverId : trip.vehicle_id || trip.vehicleId;
    return String(tripResourceId || "") === resource.id && isActiveTripStatus(trip.status);
  });
  if (activeTrip) return /in transit|delivering|dispatched|dispatching|en route|active|moving|delayed|late/i.test(String(activeTrip.status || "")) ? "In Use" : "Assigned";
  if (statusValues.some((value) => /in use|busy|in transit|working|on trip/.test(value))) return "In Use";
  const linkedBookings = bookings.filter((booking) => {
    const matchesResource = category === "drivers"
      ? String(booking.driverId || booking.driver_id || "") === resource.id
      : String(booking.vehicleId || booking.vehicle_id || "") === resource.id;
    return matchesResource && String(booking.status || "").toUpperCase() !== "CANCELLED";
  });
  if (linkedBookings.some((booking) => String(booking.status || "").toUpperCase() === "DISPATCHED")) return "In Use";
  if (statusValues.some((value) => /assigned|reserved/.test(value)) || linkedBookings.length > 0) return "Assigned";
  if (statusValues.some((value) => /available|ready|active/.test(value))) return "Available";
  return "Unavailable";
}

/* Custom Lightweight SVG Icons */
function IconCheckCircle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconPackage({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconUser({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconTruck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1m-6 0h2" />
    </svg>
  );
}

function IconSearch({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function IconClock({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconPin({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconAlert({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IconSend({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function TruckLoadingAnimation({ size = "w-8 h-8" }: { size?: string }) {
  return (
    <svg className={`${size} animate-pulse`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* Truck body */}
      <rect x="2" y="7" width="12" height="8" rx="1" />
      {/* Cab */}
      <rect x="14" y="9" width="4" height="6" rx="0.5" />
      {/* Back wheels */}
      <circle cx="5" cy="15" r="1.5" />
      <circle cx="11" cy="15" r="1.5" />
      {/* Front wheel */}
      <circle cx="17" cy="15" r="1.5" />
    </svg>
  );
}

function HeaderMetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  color: "rose" | "emerald" | "indigo" | "amber";
}) {
  const colorMap = {
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{title}</span>
        <div className={`p-2 rounded-xl border ${colorMap[color]}`}>{icon}</div>
      </div>
      <div className="mt-3">
        <span className="text-2xl font-black text-slate-900 tracking-tight">{value}</span>
        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{subtitle}</span>
      </div>
    </div>
  );
}

const STATUS_OPTIONS = ["All", "PENDING", "DRIVER_VEHICLE_ASSIGNED"] as const;
type BookingStatusFilter = (typeof STATUS_OPTIONS)[number];

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2"><span className="block truncate text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span><span className="mt-1 block truncate text-[11px] font-semibold text-slate-800">{value}</span></div>;
}

function routePlanDetails(booking?: Booking | null) {
  return booking?.routePlan?.routeDetails ?? booking?.routePlan?.route_details ?? {};
}

function routePlanName(booking?: Booking | null) {
  return routePlanDetails(booking).route_name || booking?.routePlan?.route_name || "Route plan";
}

function routePlanSequence(booking: Booking): RoutePlanPoint[] {
  const plan = booking.routePlan;
  const details = routePlanDetails(booking);
  const destinations = plan?.deliveryDestinations ?? plan?.delivery_destinations ?? booking.deliveryDestinations ?? [];
  const origin = details.origin || {
    name: plan?.pickupLocation || plan?.pickup_location || "Pickup location",
    address: plan?.pickupLocation || plan?.pickup_location || "",
    lat: plan?.pickupLatitude ?? plan?.pickup_latitude,
    lng: plan?.pickupLongitude ?? plan?.pickup_longitude,
  };
  const fallbackDestination = destinations[destinations.length - 1];
  const intermediateStops = details.stops?.length ? details.stops : destinations.slice(0, -1);
  const destination = details.destination || fallbackDestination;
  return [origin, ...intermediateStops, ...(destination ? [destination] : [])].filter((point) => Boolean(point?.name || point?.address));
}

function bookingParcelWeight(booking: Booking, bookingParcels: Parcel[]) {
  const parcelWeight = bookingParcels.reduce((total, parcel) => total + (Number(parcel.weightKg) || 0), 0);
  if (parcelWeight > 0) return parcelWeight;
  const estimatedRouteWeight = Number(routePlanDetails(booking).estimated_load_kg || 0);
  return estimatedRouteWeight > 0 ? estimatedRouteWeight : Number(booking.totalWeightKg) || 0;
}

function formatRouteDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function VrdsBookingsPage() {
  const { bookings, parcels, drivers, vehicles, ready } = useParcelStore({ history: true });
  const routeBookingSelectionHandled = useRef(false);
  const [resourceDirectoryOpen, setResourceDirectoryOpen] = useState(true);
  const [mobileResourceOpen, setMobileResourceOpen] = useState(false);
  const [resourceCategory, setResourceCategory] = useState<ResourceCategory | null>("vehicles");
  const [resourceStatusFilter, setResourceStatusFilter] = useState<ResourceStatus | "All">("Available");
  const [resourceSearch, setResourceSearch] = useState("");
  const [selectedResource, setSelectedResource] = useState<{ category: ResourceCategory; resource: ResourceRecord } | null>(null);
  const [resourceDrivers, setResourceDrivers] = useState<ResourceRecord[]>([]);
  const [resourceVehicles, setResourceVehicles] = useState<ResourceRecord[]>([]);
  const [resourceTrips, setResourceTrips] = useState<AssignmentTripRecord[]>([]);
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourceError, setResourceError] = useState("");
  const [resourceUpdatedAt, setResourceUpdatedAt] = useState<Date | null>(null);

  const refreshResourceDirectory = useCallback(async (silent = false) => {
    if (!silent) setResourceLoading(true);
    const [driverResult, vehicleResult, tripResult] = await Promise.allSettled([
      fetchJson("/api/drivers", { cache: "no-store" }),
      fetchJson("/api/vehicles", { cache: "no-store" }),
      fetchJson("/api/trips?light=true", { cache: "no-store" }),
    ]);
    const errors: string[] = [];
    if (driverResult.status === "fulfilled" && Array.isArray(driverResult.value)) setResourceDrivers(driverResult.value as ResourceRecord[]);
    else if (driverResult.status === "rejected") errors.push(driverResult.reason instanceof Error ? driverResult.reason.message : "Unable to load drivers.");
    if (vehicleResult.status === "fulfilled" && Array.isArray(vehicleResult.value)) setResourceVehicles(vehicleResult.value as ResourceRecord[]);
    else if (vehicleResult.status === "rejected") errors.push(vehicleResult.reason instanceof Error ? vehicleResult.reason.message : "Unable to load vehicles.");
    if (tripResult.status === "fulfilled" && Array.isArray(tripResult.value)) setResourceTrips(tripResult.value as AssignmentTripRecord[]);
    else if (tripResult.status === "rejected") errors.push(tripResult.reason instanceof Error ? tripResult.reason.message : "Unable to verify active trips.");
    setResourceError(errors.join(" "));
    setResourceUpdatedAt(new Date());
    setResourceLoading(false);
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshResourceDirectory(true), 0);
    const intervalId = window.setInterval(() => void refreshResourceDirectory(true), 30_000);
    const onFocus = () => void refreshResourceDirectory(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshResourceDirectory]);

  const availableDrivers = useMemo(
    () => drivers.filter((driver) => driver.status === "Available"),
    [drivers]
  );
  const availableVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === "Available"),
    [vehicles]
  );
  const directoryRecords = resourceCategory === "drivers" ? resourceDrivers : resourceVehicles;
  const directoryStatusCounts = useMemo(() => {
    const records = resourceCategory === "drivers" ? resourceDrivers : resourceVehicles;
    return Object.fromEntries(RESOURCE_STATUSES.map((status) => [
      status,
      records.filter((resource) => resourceStatus(resource, resourceCategory || "vehicles", bookings, resourceTrips) === status).length,
    ])) as Record<ResourceStatus, number>;
  }, [bookings, resourceCategory, resourceDrivers, resourceTrips, resourceVehicles]);
  const filteredDirectoryRecords = useMemo(() => {
    const term = resourceSearch.trim().toLowerCase();
    return directoryRecords.filter((resource) => {
      if (resourceStatusFilter !== "All" && resourceStatus(resource, resourceCategory || "vehicles", bookings, resourceTrips) !== resourceStatusFilter) return false;
      if (!term) return true;
      const haystack = [
        resource.id, resource.name, resource.full_name, resource.plate, resource.plate_number,
        resource.model, resource.vehicle_type, resource.type, resource.email, resource.phone,
        resource.courier, resource.courier_name,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [bookings, directoryRecords, resourceCategory, resourceSearch, resourceStatusFilter, resourceTrips]);

  const courierMatches = (assignedCourier: string | undefined, shipmentCourier: string) => {
    if (!shipmentCourier) return true;
    if (!assignedCourier) return false;

    const normalize = (value: string) => value.toLowerCase().replace(/express|delivery|xpress|courier/g, "").replace(/[^a-z0-9]/g, "");
    const left = normalize(assignedCourier);
    const right = normalize(shipmentCourier);
    return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
  };

  const sameCourierToken = (value?: string) =>
    String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  const matchesBookingCourier = (
    resource: { courier?: string; courierId?: string | null } | undefined,
    bookingCourier?: string,
    bookingCourierId?: string
  ) => {
    if (!resource) return false;
    if (bookingCourierId && resource.courierId) {
      return String(resource.courierId) === String(bookingCourierId);
    }
    if (!bookingCourier) return true;
    const resourceCourier = resource.courier || "";
    return courierMatches(resourceCourier, bookingCourier);
  };

  const sameCourierPair = (
    driver: { courier?: string; courierId?: string | null } | undefined,
    vehicle: { courier?: string; courierId?: string | null } | undefined,
    bookingCourier?: string,
    bookingCourierId?: string
  ) => {
    if (!driver || !vehicle) return false;
    if (!bookingCourier && !bookingCourierId) return true;

    const driverMatches = matchesBookingCourier(driver, bookingCourier, bookingCourierId);
    const vehicleMatches = matchesBookingCourier(vehicle, bookingCourier, bookingCourierId);
    if (driverMatches && vehicleMatches) return true;

    const driverHasMetadata = Boolean(driver.courier || driver.courierId);
    const vehicleHasMetadata = Boolean(vehicle.courier || vehicle.courierId);
    const hasAnyCourierMetadata = driverHasMetadata || vehicleHasMetadata;

    if (!hasAnyCourierMetadata) return true;
    if (!driverHasMetadata || !vehicleHasMetadata) return true;

    const sharedCourierId = Boolean(
      driver.courierId && vehicle.courierId && String(driver.courierId) === String(vehicle.courierId)
    );
    const sharedCourierName = Boolean(
      driver.courier && vehicle.courier && sameCourierToken(driver.courier) === sameCourierToken(vehicle.courier)
    );

    if (sharedCourierId || sharedCourierName) return true;

    const bookingCourierToken = bookingCourier ? sameCourierToken(bookingCourier) : "";
    const driverMatchesBookingName = Boolean(
      driver.courier && bookingCourierToken && sameCourierToken(driver.courier) === bookingCourierToken
    );
    const vehicleMatchesBookingName = Boolean(
      vehicle.courier && bookingCourierToken && sameCourierToken(vehicle.courier) === bookingCourierToken
    );

    return Boolean(driverMatchesBookingName && vehicleMatchesBookingName);
  };

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [loadingBookingId, setLoadingBookingId] = useState<string | null>(null);
  const [dispatchingBookingId, setDispatchingBookingId] = useState<string | null>(null);
  const [assignmentStep, setAssignmentStep] = useState<"driver" | "vehicle">("driver");
  const [toast, setToast] = useState<string | null>(null);
  const [errorFor, setErrorFor] = useState<{ id: string; message: string } | null>(null);
  const [assignmentErrorModal, setAssignmentErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: "",
  });
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("All");
  const [draggedAssignment, setDraggedAssignment] = useState<{
    type: "driver" | "vehicle";
    id: string;
  } | null>(null);
  const [isDriverOver, setIsDriverOver] = useState(false);
  const [isVehicleOver, setIsVehicleOver] = useState(false);

  useEffect(() => {
    if (!ready || routeBookingSelectionHandled.current) return;
    const bookingId = new URLSearchParams(window.location.search).get("bookingId");
    if (!bookingId) {
      routeBookingSelectionHandled.current = true;
      return;
    }
    const booking = bookings.find((item) => String(item.id) === bookingId);
    if (!booking) return;
    routeBookingSelectionHandled.current = true;
    startTransition(() => {
      setSelectedBookingId(booking.id);
      setAssignmentStep("driver");
      setIsDetailsModalOpen(true);
    });
  }, [bookings, ready]);

  const openBookings = useMemo(
    () => bookings.filter((b) => b.status === "PENDING" || b.status === "DRIVER_VEHICLE_ASSIGNED"),
    [bookings]
  );

  const routeOptimizedBookings = useMemo(
    () => openBookings.filter((booking) => {
      const hasRoutePlan = Boolean(booking.routePlanId);
      const hasDeliveryStops = Array.isArray(booking.deliveryDestinations) && booking.deliveryDestinations.length > 0;
      const hasParcelRoutePlan = parcels.some(
        (parcel) => parcel.bookingId === booking.id && Boolean(parcel.routePlanId)
      );
      return hasRoutePlan || hasDeliveryStops || hasParcelRoutePlan;
    }),
    [openBookings, parcels]
  );

  const getBookingRouteLabel = useCallback((booking: Booking, parcelList: typeof parcels = parcels) => {
    const genericLabelPattern = /selected delivery destinations|route preview|airship express hub.*binondo/i;
    const normalized = booking.routeLabel || "";
    const details = routePlanDetails(booking);
    const routeName = details.route_name || booking.routePlan?.route_name;
    const sequence = routePlanSequence(booking);
    const routeSummary = sequence.length > 1
      ? `${sequence[0].name || sequence[0].address} → ${sequence[sequence.length - 1].name || sequence[sequence.length - 1].address}`
      : normalized;
    if (!genericLabelPattern.test(normalized)) return routeName ? `${routeName} · ${routeSummary || normalized}` : normalized || "Airship Express Hub - Binondo, Manila";

    const routeParcels = parcelList.filter((parcel) => parcel.bookingId === booking.id);
    const addresses = routeParcels
      .map((parcel) => parcel.destinationAddress)
      .filter((value): value is string => Boolean(value && value.trim()));

    const routeLabel = routeSummary || (addresses.length > 0
      ? `Airship Express Hub - Binondo, Manila → ${addresses.slice(0, 3).join(" • ")}`
      : "Airship Express Hub - Binondo, Manila → Route destinations");

    return routeName ? `${routeName} · ${routeLabel}` : routeLabel;
  }, [parcels]);

  const visibleBookings = routeOptimizedBookings.length > 0 ? routeOptimizedBookings : openBookings;

  const filteredBookings = useMemo(() => {
    return visibleBookings.filter((booking) => {
      const matchesStatus = statusFilter === "All" || booking.status === statusFilter;
      const routeLabel = getBookingRouteLabel(booking, parcels);
      const matchesSearch =
        searchText.trim().length === 0 ||
        [booking.id, routeLabel, booking.driverName ?? "", booking.vehiclePlate ?? ""].some(
          (value) => value.toLowerCase().includes(searchText.toLowerCase())
        );
      return matchesStatus && matchesSearch;
    });
  }, [getBookingRouteLabel, visibleBookings, parcels, searchText, statusFilter]);

  const bookingsById = useMemo(
    () => Object.fromEntries(visibleBookings.map((booking) => [booking.id, booking])) as Record<string, Booking>,
    [visibleBookings]
  );

  const selectedBooking = selectedBookingId && bookingsById[selectedBookingId]
    ? bookingsById[selectedBookingId]
    : filteredBookings[0] ?? null;
  const selectedBookingParcels = selectedBooking ? parcels.filter((parcel) => parcel.bookingId === selectedBooking.id) : [];
  const selectedBookingWeightKg = selectedBooking ? bookingParcelWeight(selectedBooking, selectedBookingParcels) : 0;
  const selectedRoutePlan = selectedBooking?.routePlan;
  const selectedRouteDetails = routePlanDetails(selectedBooking);
  const selectedRouteSequence = selectedBooking ? routePlanSequence(selectedBooking) : [];

  const assignedBookings = openBookings.filter((booking) => booking.driverId && booking.vehicleId).length;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const handleAssignDriver = (bookingId: string, driverId: string) => {
    assignDriver(bookingId, driverId);
    showToast(`Driver updated for booking #${bookingId}`);
  };

  const handleAssignVehicle = (bookingId: string, vehicleId: string) => {
    assignVehicle(bookingId, vehicleId);
    showToast(`Vehicle updated for booking #${bookingId}`);
  };

  const handleGenerateAssignment = async (booking: Booking) => {
    let tripRows: AssignmentTripRecord[];
    try {
      const response = await fetchJson("/api/trips?light=true", { cache: "no-store" });
      if (!Array.isArray(response)) throw new Error("Trip availability could not be verified.");
      tripRows = response as AssignmentTripRecord[];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to verify current trip assignments.";
      setErrorFor({ id: booking.id, message });
      setAssignmentErrorModal({ isOpen: true, message });
      return;
    }

    setResourceTrips(tripRows);
    const activeTrips = tripRows.filter((trip) => isActiveTripStatus(trip.status));
    const activeDriverIds = new Set(activeTrips.map((trip) => String(trip.driver_id || trip.driverId || "")).filter(Boolean));
    const activeVehicleIds = new Set(activeTrips.map((trip) => String(trip.vehicle_id || trip.vehicleId || "")).filter(Boolean));
    const eligibleAvailableDrivers = availableDrivers.filter((driver) => !activeDriverIds.has(String(driver.id)));
    const eligibleAvailableVehicles = availableVehicles.filter((vehicle) => !activeVehicleIds.has(String(vehicle.id)));

    console.log("[DEBUG] handleGenerateAssignment called with booking:", {
      bookingId: booking.id,
      parcelsCount: parcels.length,
      driversCount: drivers.length,
      availableDriversCount: availableDrivers.length,
      vehiclesCount: vehicles.length,
      availableVehiclesCount: availableVehicles.length,
      bookingTotalWeightKg: booking.totalWeightKg,
      bookingCourier: booking.courier,
    });

    // Calculate actual weight from parcels if booking weight is 0
    const bookingParcels = parcels.filter((p) => p.bookingId === booking.id);
    const actualWeightKg = bookingParcelWeight(booking, bookingParcels);
    const hasMeaningfulWeight = Number.isFinite(actualWeightKg) && actualWeightKg > 0;

    console.log("[DEBUG] Weight calculation:", {
      bookingTotalWeightKg: booking.totalWeightKg,
      bookingParcelsCount: bookingParcels.length,
      actualWeightKg,
      hasMeaningfulWeight,
    });

    const bookingCourier =
      booking.courier ||
      parcels
        .filter((parcel) => parcel.bookingId === booking.id)
        .map((parcel) => parcel.courier)
        .find(Boolean) ||
      "";

    console.log("[DEBUG] Resolved booking courier:", bookingCourier);

    const driverPool = booking.driverId
      ? drivers.filter((item) => !activeDriverIds.has(String(item.id)) && (eligibleAvailableDrivers.includes(item) || item.id === booking.driverId))
      : eligibleAvailableDrivers;
    const vehiclePool = booking.vehicleId
      ? vehicles.filter((item) => !activeVehicleIds.has(String(item.id)) && (eligibleAvailableVehicles.includes(item) || item.id === booking.vehicleId))
      : eligibleAvailableVehicles;
    const matchedDrivers = bookingCourier ? driverPool.filter((item) => courierMatches(item.courier, bookingCourier)) : driverPool;
    const matchedVehicles = bookingCourier ? vehiclePool.filter((item) => courierMatches(item.courier, bookingCourier)) : vehiclePool;
    const sameCourierDrivers = booking.courierId
      ? driverPool.filter((item) => matchesBookingCourier(item, bookingCourier, booking.courierId))
      : matchedDrivers;
    const sameCourierVehicles = booking.courierId
      ? vehiclePool.filter((item) => matchesBookingCourier(item, bookingCourier, booking.courierId))
      : matchedVehicles;
    const driversHaveCourierMetadata = driverPool.some((item) => Boolean(item.courier));
    const vehiclesHaveCourierMetadata = vehiclePool.some((item) => Boolean(item.courier));
    const candidateDrivers = bookingCourier && driversHaveCourierMetadata
      ? (sameCourierDrivers.length > 0 ? sameCourierDrivers : matchedDrivers.length > 0 ? matchedDrivers : driverPool)
      : driverPool;
    const candidateVehicles = bookingCourier && vehiclesHaveCourierMetadata
      ? (sameCourierVehicles.length > 0 ? sameCourierVehicles : matchedVehicles.length > 0 ? matchedVehicles : vehiclePool)
      : vehiclePool;

    const driver = booking.driverId
      ? candidateDrivers.find((item) => item.id === booking.driverId) ?? candidateDrivers[0]
      : candidateDrivers[0];

    const effectiveVehiclePool = candidateVehicles.length > 0 ? candidateVehicles : eligibleAvailableVehicles;
    const capacityReadyVehicles = hasMeaningfulWeight
      ? effectiveVehiclePool.filter((item) => item.capacityKg >= actualWeightKg)
      : [...effectiveVehiclePool];
    const fallbackVehicle = [...capacityReadyVehicles].sort((a, b) => a.capacityKg - b.capacityKg)[0]
      ?? effectiveVehiclePool[0]
      ?? null;
    const vehicle = booking.vehicleId
      ? effectiveVehiclePool.find(
          (item) => item.id === booking.vehicleId && (!hasMeaningfulWeight || item.capacityKg >= actualWeightKg) && item.status === "Available"
        ) ?? fallbackVehicle
      : fallbackVehicle;

    console.log("[DEBUG] Vehicle availability details:", {
      totalVehicles: vehicles.length,
      availableVehicles: availableVehicles.length,
      candidateVehicles: candidateVehicles.length,
      effectiveVehiclePool: effectiveVehiclePool.length,
      capacityReadyVehicles: capacityReadyVehicles.length,
      availableVehiclesDetails: availableVehicles.map((v) => ({
        id: v.id,
        plate: v.plate,
        capacity: v.capacityKg,
        status: v.status,
      })),
      selectedVehicle: vehicle ? { id: vehicle.id, plate: vehicle.plate, capacityKg: vehicle.capacityKg } : null,
    });

    const driverUnavailable = !driver || activeDriverIds.has(String(driver.id)) || (driver.status !== "Available" && driver.id !== booking.driverId);
    const vehicleUnavailable = hasMeaningfulWeight
      ? !vehicle || activeVehicleIds.has(String(vehicle.id)) || vehicle.capacityKg < actualWeightKg
      : effectiveVehiclePool.length === 0 || Boolean(vehicle && activeVehicleIds.has(String(vehicle.id)));
    const pairMismatch = !sameCourierPair(driver, vehicle, bookingCourier, booking.courierId);

    console.log("[DEBUG] Availability check:", {
      driverUnavailable,
      vehicleUnavailable,
      pairMismatch,
      actualWeightKg,
      bookingCourier,
      bookingCourierId: booking.courierId,
      driverCourier: driver?.courier,
      vehicleCourier: vehicle?.courier,
    });

    if (driverUnavailable || vehicleUnavailable || pairMismatch) {
      let errorMsg = "";
      if (pairMismatch) {
        errorMsg = `No compatible ${bookingCourier || "same-courier"} driver and vehicle are available for this booking.`;
      } else if (vehicleUnavailable) {
        if (availableVehicles.length === 0) {
          errorMsg = `No available vehicles in the system. All vehicles are currently assigned.`;
        } else if (hasMeaningfulWeight && capacityReadyVehicles.length === 0) {
          errorMsg = `No vehicle can carry ${actualWeightKg} kg. Available vehicles: ${availableVehicles.map((v) => `${v.plate} (${v.capacityKg}kg)`).join(", ")}`;
        } else {
          errorMsg = `No vehicle can carry 0 kg. Available vehicles: ${availableVehicles.map((v) => `${v.plate} (${v.capacityKg}kg)`).join(", ")}`;
        }
      } else if (driverUnavailable) {
        errorMsg = `No available driver can be assigned right now for ${bookingCourier || "this route"}.`;
      }
      console.log("[DEBUG] Setting error:", errorMsg);
      setErrorFor({
        id: booking.id,
        message: errorMsg,
      });
      setAssignmentErrorModal({
        isOpen: true,
        message: errorMsg,
      });
      return;
    }

    console.log("[DEBUG] Proceeding with assignment...");
    setLoadingBookingId(booking.id);
    setErrorFor(null);

    try {
      console.log("[DEBUG] Calling assignDriverAndVehicle:", {
        bookingId: booking.id,
        driverId: driver!.id,
        vehicleId: vehicle!.id,
      });
      await assignBookingResources(booking.id, {
        driver_id: driver!.id,
        driver_name: driver!.name,
        vehicle_id: vehicle!.id,
        vehicle_plate: vehicle!.plateNumber ?? vehicle!.plate,
      });
      assignDriverAndVehicle(booking.id, driver!.id, vehicle!.id);
      setAssignmentStep("vehicle");
      setLoadingBookingId(null);
      setSelectedBookingId(booking.id);
      setIsDetailsModalOpen(true);
      showToast(
        `Assigned ${bookingCourier || driver!.name} route to ${driver!.name} with ${vehicle!.plateNumber ?? vehicle!.plate ?? "selected vehicle"}.`
      );
    } catch (error) {
      setLoadingBookingId(null);
      const message = error instanceof Error ? error.message : "Unable to save the assignment.";
      setErrorFor({ id: booking.id, message });
      setAssignmentErrorModal({ isOpen: true, message });
    }
  };

  type RoutePlanDestination = {
    name?: string;
    label?: string;
    lat?: number | string | null;
    lng?: number | string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };

  type RoutePlanResponse = {
    deliveryDestinations?: RoutePlanDestination[];
    pickupLocation?: string;
    pickupLatitude?: number | string | null;
    pickupLongitude?: number | string | null;
    distanceKm?: number | null;
    distance_km?: number | null;
    durationMinutes?: number | null;
    estimated_duration_min?: number | null;
  };

  const handleConfirm = async (booking: Booking) => {
    const selectedBookingParcels = parcels.filter((parcel) => parcel.bookingId === booking.id);
    const destinationParcel = selectedBookingParcels[0];
    const driver = drivers.find((item) => item.id === booking.driverId);

    if (!booking.driverId || !booking.vehicleId) {
      setErrorFor({ id: booking.id, message: "Assign both a driver and a vehicle before dispatching." });
      return;
    }

    setDispatchingBookingId(booking.id);
    setErrorFor(null);

    try {
      const routePlanId = booking.routePlanId || selectedBookingParcels.find((p) => p.routePlanId)?.routePlanId;
      let planStops: { name: string; lat: number; lng: number }[] = [];
      let planPickup: { label?: string; lat?: number; lng?: number } | null = null;
      let activeRoutePlan: RoutePlanResponse | null = null;

      if (routePlanId) {
        try {
          activeRoutePlan = await getRoutePlan(routePlanId);
          const dests = Array.isArray(activeRoutePlan?.deliveryDestinations) ? activeRoutePlan.deliveryDestinations : [];
          planStops = dests
            .map((d) => ({
              name: d.name || d.label || "Stop",
              lat: Number(d.lat ?? d.latitude),
              lng: Number(d.lng ?? d.longitude),
            }))
            .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
          if (activeRoutePlan?.pickupLocation) {
            planPickup = { label: activeRoutePlan.pickupLocation, lat: Number(activeRoutePlan.pickupLatitude), lng: Number(activeRoutePlan.pickupLongitude) };
          }
        } catch (err) {
          console.warn(`Unable to load route plan ${routePlanId}; falling back to single destination.`, err);
        }
      }

      const finalStop = planStops[planStops.length - 1];
      const fromLocation = planPickup?.label || "Airship Express Hub - Binondo, Manila";
      const fromLat = planPickup?.lat || 14.5995;
      const fromLng = planPickup?.lng || 120.9745;

      await createTrip({
        id: `TRIP-${booking.id}`,
        booking_id: booking.id,
        route_plan_id: routePlanId,
        driver_id: booking.driverId,
        driver_name: driver?.name || booking.driverName,
        vehicle_id: booking.vehicleId,
        from_location: fromLocation,
        to_location: finalStop?.name || getBookingRouteLabel(booking, parcels),
        from_latitude: fromLat,
        from_longitude: fromLng,
        to_latitude: finalStop?.lat || destinationParcel?.destLat || 0,
        to_longitude: finalStop?.lng || destinationParcel?.destLng || 0,
        status: "Pickup Assigned",
        progress: 0,
        load_kg: booking.totalWeightKg,
        stops: planStops,
        distance_km: activeRoutePlan?.distanceKm ?? activeRoutePlan?.distance_km ?? null,
        duration_minutes: activeRoutePlan?.durationMinutes ?? activeRoutePlan?.estimated_duration_min ?? null,
      });

      const result = confirmDispatch(booking.id);
      if (!result.ok) {
        setErrorFor({ id: booking.id, message: result.reason || "Unable to dispatch booking." });
        return;
      }

      setErrorFor(null);
      showToast(`Booking ${booking.id} assigned for hub pickup. Driver proof is required before the delivery trip starts.`);

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("ftm:loading", { detail: { destination: `/vrds/missions?dispatch=${booking.id}` } }));
      }, 500);
    } catch (error) {
      setErrorFor({
        id: booking.id,
        message: error instanceof Error ? error.message : "Unable to create delivery trip.",
      });
    } finally {
      setDispatchingBookingId((current) => (current === booking.id ? null : current));
    }
  };

  const selectedParcels = selectedBooking
    ? parcels.filter((parcel) => parcel.bookingId === selectedBooking.id)
    : [];

  const fallbackParcels =
    selectedBooking && selectedParcels.length === 0 && selectedBooking.parcelIds.length > 0
      ? selectedBooking.parcelIds
          .map((parcelId) => parcels.find((p) => String(p.id) === String(parcelId)))
          .filter((p): p is (typeof parcels)[0] => p !== undefined)
      : [];

  const syntheticCount =
    selectedBooking && selectedParcels.length === 0 && fallbackParcels.length === 0
      ? selectedBooking.parcelIds?.length || selectedBooking.parcelCount || 0
      : 0;

  const syntheticParcels =
    syntheticCount > 0
      ? Array.from({ length: syntheticCount }, (_, i) => ({
          id: `${selectedBooking!.id}-parcel-${i + 1}`,
          trackingNumber: `TRK-${selectedBooking!.id}-${i + 1}`,
          senderName: "Airship Central",
          senderPhone: "",
          recipientName: "Destination Hub Receiver",
          recipientPhone: "",
          destinationAddress: "Hub Destination",
          destLat: 0,
          destLng: 0,
          parcelType: "E-commerce Package" as const,
          courier: undefined as string | undefined,
          weightKg: Math.round((selectedBooking!.totalWeightKg / syntheticCount) * 10) / 10,
          notes: undefined,
          status: "PICKED_UP" as const,
          receivedAt: new Date().toISOString(),
          bookingId: selectedBooking!.id,
        }))
      : [];

  const displayParcels =
    selectedParcels.length > 0 ? selectedParcels : fallbackParcels.length > 0 ? fallbackParcels : syntheticParcels;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <GlobalNavbar />

      {dispatchingBookingId && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
          <div className="w-[min(92vw,420px)] rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative mb-4 flex h-20 w-28 items-center justify-center overflow-hidden rounded-2xl bg-rose-50">
                <div className="absolute left-2 right-2 top-1/2 flex -translate-y-1/2 items-center justify-between">
                  <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse" />
                  <div className="ml-4 h-2 w-16 rounded-full bg-rose-200">
                    <div className="h-full w-1/2 rounded-full bg-rose-500 animate-pulse" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-4xl text-rose-600 animate-bounce">local_shipping</span>
                </div>
                <div className="absolute -left-8 bottom-3 h-3 w-16 rounded-full bg-slate-300/80" />
                <div className="absolute bottom-3 right-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-rose-500">Pickup assignment in progress</p>
              <h3 className="mt-2 text-xl font-extrabold text-slate-900">Assigning hub pickup</h3>
              <p className="mt-2 text-sm text-slate-600">
                Assigning driver and vehicle to collect parcels from the hub for <span className="font-semibold text-slate-800">{dispatchingBookingId}</span>
              </p>

              <div className="mt-5 flex w-full items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-rose-100">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-fuchsia-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <IconCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Section */}
        <section className="relative overflow-hidden bg-white border border-rose-100 rounded-3xl p-6 lg:p-8 shadow-xs">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-rose-100/40 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/60 text-xs font-bold uppercase tracking-wider text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                VRDS Fleet Dispatch Center
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                Dispatch Management Queue
              </h1>
              <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
                Assign drivers and vehicles, monitor payload capacity, inspect delivery drop points, and authorize dispatch orders.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
              <HeaderMetricCard
                title="Active Queue"
                value={openBookings.length}
                subtitle="Bookings"
                icon={<IconPackage className="w-5 h-5 text-rose-600" />}
                color="rose"
              />
              <HeaderMetricCard
                title="Ready"
                value={assignedBookings}
                subtitle="Assigned"
                icon={<IconCheck className="w-5 h-5 text-emerald-600" />}
                color="emerald"
              />
              <HeaderMetricCard
                title="Drivers"
                value={availableDrivers.length}
                subtitle="Available"
                icon={<IconUser className="w-5 h-5 text-indigo-600" />}
                color="indigo"
              />
              <HeaderMetricCard
                title="Fleet"
                value={availableVehicles.length}
                subtitle="Ready"
                icon={<IconTruck className="w-5 h-5 text-amber-600" />}
                color="amber"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between lg:hidden">
          <button type="button" onClick={() => { setResourceDirectoryOpen(true); setMobileResourceOpen(true); }} className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3.5 py-2.5 text-xs font-bold text-rose-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50">
            <Truck className="h-4 w-4" /> Fleet resources
          </button>
          <span className="text-[10px] font-medium text-slate-400">{availableVehicles.length} vehicles · {availableDrivers.length} drivers ready</span>
        </div>
        {mobileResourceOpen && <button type="button" aria-label="Close fleet resources menu" onClick={() => setMobileResourceOpen(false)} className="fixed inset-0 z-[1249] bg-slate-950/35 backdrop-blur-[2px] lg:hidden" />}

        <div className={`grid items-start gap-5 transition-[grid-template-columns] duration-300 ease-out lg:gap-6 ${resourceDirectoryOpen ? "lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]" : "lg:grid-cols-[48px_minmax(0,1fr)]"}`}>
        {resourceDirectoryOpen ? <aside className={`hide-scrollbar min-w-0 overflow-hidden border border-rose-100/90 bg-white shadow-[0_8px_28px_rgba(190,24,93,0.07)] transition-all duration-300 ${mobileResourceOpen ? "fixed inset-y-0 left-0 z-[1250] w-[min(88vw,360px)] rounded-none" : "hidden rounded-2xl lg:sticky lg:top-4 lg:block"} lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto`}>
          <div className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.1)]" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-rose-500">Fleet directory</p>
                </div>
                <h2 className="mt-1.5 text-sm font-bold text-slate-900">Resources</h2>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Vehicles and drivers by status</p>
              </div>
              <button type="button" onClick={() => void refreshResourceDirectory()} disabled={resourceLoading} aria-label="Refresh fleet resources" title="Refresh resources" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-600 transition duration-200 hover:border-rose-200 hover:bg-rose-50 hover:shadow-sm disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${resourceLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <p className="text-[9px] text-slate-400">{resourceUpdatedAt ? `Updated ${resourceUpdatedAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}` : "Syncing fleet data"}</p>
              <button type="button" aria-expanded={resourceDirectoryOpen} onClick={() => { setResourceDirectoryOpen(false); setMobileResourceOpen(false); }} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300" title="Collapse resource sidebar">
                Hide <ChevronDown className="h-3 w-3 rotate-90" />
              </button>
              <button type="button" onClick={() => setMobileResourceOpen(false)} aria-label="Close fleet resources" className="rounded-md p-1 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 lg:hidden"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="border-b border-rose-100 p-3">
              <p className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">Browse category</p>
              {(["vehicles", "drivers"] as const).map((category) => <button key={category} type="button" aria-pressed={resourceCategory === category} onClick={() => { setResourceCategory(category); setResourceStatusFilter("Available"); }} className={`mb-1 flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left transition duration-200 ${resourceCategory === category ? "border-rose-200 bg-rose-50/70 text-rose-700 shadow-[0_2px_8px_rgba(190,24,93,0.07)]" : "border-transparent text-slate-600 hover:border-rose-100 hover:bg-rose-50/40"}`}><span className="flex min-w-0 items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${resourceCategory === category ? "bg-white text-rose-600" : category === "vehicles" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{category === "vehicles" ? <Truck className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}</span><span className="text-[11px] font-bold">{category === "vehicles" ? "Vehicles" : "Drivers"}</span></span><span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[9px] font-bold ${resourceCategory === category ? "bg-white text-rose-600" : "bg-slate-100 text-slate-500"}`}>{category === "vehicles" ? resourceVehicles.length : resourceDrivers.length}</span></button>)}
            </div>
            <div className="min-w-0 p-3">
              {!resourceCategory ? <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-rose-200 bg-white px-4 text-center text-xs text-slate-500">Choose Vehicles or Drivers to browse fleet records.</div> : <>
                <div className="mb-2.5 space-y-2">
                  <div className="flex items-center justify-between px-1"><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-400">Availability</p><span className="text-[9px] font-medium text-slate-400">{resourceCategory === "vehicles" ? "Fleet" : "Team"}</span></div>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-rose-100/80 bg-rose-50/30 p-1" role="tablist" aria-label={`${resourceCategory} status filters`}>
                    {RESOURCE_STATUSES.map((status) => <button key={status} type="button" role="tab" aria-selected={resourceStatusFilter === status} onClick={() => setResourceStatusFilter(status)} className={`flex min-w-0 items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-[9px] font-semibold transition-colors ${resourceStatusFilter === status ? "bg-rose-600 text-white shadow-sm" : "bg-white/70 text-slate-600 hover:bg-white hover:text-rose-700"}`}><span className="truncate">{status}</span><span className={`shrink-0 text-[9px] tabular-nums ${resourceStatusFilter === status ? "text-rose-100" : "text-slate-400"}`}>{directoryStatusCounts[status]}</span></button>)}
                  </div>
                  <label className="relative block min-w-0 w-full"><IconSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input aria-label={`Search ${resourceCategory}`} value={resourceSearch} onChange={(event) => setResourceSearch(event.target.value)} placeholder={resourceCategory === "vehicles" ? "Search plate or model" : "Search name or contact"} className="w-full rounded-lg border border-slate-200/90 bg-white py-2 pl-8 pr-2.5 text-[11px] outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:ring-2 focus:ring-rose-100" /></label>
                </div>
                {resourceError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"><span>{resourceError}</span><button type="button" onClick={() => void refreshResourceDirectory()} className="font-bold underline">Retry</button></div>}
                {resourceLoading && resourceVehicles.length === 0 && resourceDrivers.length === 0 ? <div role="status" className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-[11px] text-slate-500">Loading fleet resources…</div> : filteredDirectoryRecords.length === 0 ? <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-3 text-center"><p className="text-[11px] font-semibold text-slate-700">No {resourceStatusFilter.toLowerCase()} {resourceCategory} found</p><p className="mt-1 text-[9px] text-slate-500">Try another status or search.</p></div> : <div className="space-y-1.5 pr-0.5">{filteredDirectoryRecords.map((resource) => {
                  const status = resourceStatus(resource, resourceCategory, bookings, resourceTrips);
                  const name = resourceCategory === "drivers" ? resourceDisplayValue(resourceValue(resource, "full_name", "name")) : resourceDisplayValue(resourceValue(resource, "plate_number", "plate", "plateNumber"));
                  const secondary = resourceCategory === "drivers" ? resourceDisplayValue(resourceValue(resource, "email", "phone")) : [resourceValue(resource, "make"), resourceValue(resource, "model", "vehicle_type", "type")].filter(Boolean).join(" ") || "Vehicle details unavailable";
                  const statusStyle = status === "Available" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : status === "In Use" ? "bg-amber-50 text-amber-700 border-amber-200" : status === "Assigned" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-100 text-slate-600 border-slate-200";
                  return <button key={resource.id} type="button" onClick={() => setSelectedResource({ category: resourceCategory, resource })} className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-rose-100/80 bg-white px-2.5 py-2 text-left shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition duration-150 hover:border-rose-200 hover:bg-rose-50/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${resourceCategory === "vehicles" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-600"}`}>{resourceCategory === "vehicles" ? <Truck className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-slate-900 group-hover:text-rose-700">{name}</span><span className="mt-0.5 block truncate text-[9px] leading-3 text-slate-500">{secondary}</span><span className="mt-1 block truncate font-mono text-[8px] text-slate-400">ID {resource.id}</span></span><span className={`shrink-0 rounded-full border px-1.5 py-1 text-[8px] font-bold leading-none ${statusStyle}`}>{status}</span></button>;
                })}</div>}
              </>}
            </div>
        </aside> : <aside className="flex h-12 w-12 items-start justify-center rounded-2xl border border-rose-100/90 bg-white p-1.5 shadow-[0_8px_28px_rgba(190,24,93,0.07)] transition-all duration-300 lg:sticky lg:top-4" aria-label="Collapsed fleet resources sidebar">
          <button type="button" aria-expanded={false} onClick={() => setResourceDirectoryOpen(true)} aria-label="Show fleet resources" title="Show fleet resources" className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </aside>}

        {/* Master / Detail Split Grid */}
        <div className="min-w-0">
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          
          {/* LEFT: Booking Queue List */}
          <section className="lg:col-span-12 space-y-4">
            
            {/* Search & Filter */}
            <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <IconSearch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search route, driver, booking ID, or vehicle plate..."
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition placeholder:text-slate-400 font-medium"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as BookingStatusFilter)}
                  className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition text-slate-700 font-bold cursor-pointer"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "All" ? "All Bookings" : BOOKING_STATUS_LABEL[option] || option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Booking Queue Cards */}
            {!ready ? (
              <SkeletonTable rows={5} />
            ) : filteredBookings.length === 0 ? (
              <div className="bg-white border border-dashed border-rose-200 rounded-2xl p-12 text-center space-y-2">
                <IconPackage className="w-10 h-10 text-rose-300 mx-auto" />
                <p className="text-base font-bold text-slate-800">No matching bookings found</p>
                <p className="text-xs text-slate-500">Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {filteredBookings.map((booking) => {
                  const isSelected = selectedBooking?.id === booking.id;
                  const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
                  const currentBookingParcels = parcels.filter((p) => p.bookingId === booking.id);
                  const displayWeightKg = bookingParcelWeight(booking, currentBookingParcels);
                  const isOverCapacity = vehicle ? displayWeightKg > vehicle.capacityKg : false;
                  const parcelCount = currentBookingParcels.length || booking.parcelIds.length || booking.parcelCount || 0;
                  const bookingCourier = booking.courier || currentBookingParcels[0]?.courier || booking.routePlan?.courier || "Unassigned";
                  const bookingRouteDetails = routePlanDetails(booking);
                  const bookingRouteSequence = booking.routePlan ? routePlanSequence(booking) : [];
                  const cardIdentifier = booking.routePlanId || /^ROUTE-/i.test(booking.id)
                    ? (routePlanName(booking) === "Route plan" ? getBookingRouteLabel(booking, parcels) : routePlanName(booking))
                    : `#${booking.id}`;

                  return (
                    <div
                      key={booking.id}
                      className={`group relative overflow-hidden cursor-pointer bg-white rounded-2xl border p-5 transition-all duration-200 shadow-xs hover:shadow-md ${
                        isSelected
                          ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/10"
                          : "border-slate-200 hover:border-rose-300"
                      }`}
                    >
                      <div className="absolute inset-0 rounded-2xl backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200" />

                      <div className="relative z-10 opacity-100 group-hover:opacity-0 transition-all duration-200">
                        {/* Top Meta */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg">
                              {cardIdentifier}
                            </span>
                            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                              <IconClock className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(booking.createdAt).toLocaleString("en-PH", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              booking.status === "DRIVER_VEHICLE_ASSIGNED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                booking.status === "DRIVER_VEHICLE_ASSIGNED" ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                            />
                            {BOOKING_STATUS_LABEL[booking.status]}
                          </span>
                        </div>

                        {/* Route Header */}
                        <div className="my-3">
                          <div className="flex items-start gap-2">
                            <IconPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-rose-600 transition-colors line-clamp-2">
                              {getBookingRouteLabel(booking, parcels)}
                            </h3>
                          </div>
                          {(booking.routePlan || booking.routePlanId) && <p className="mt-1 pl-6 text-[10px] text-slate-500"><span className="font-semibold text-slate-700">{routePlanName(booking)}</span>{booking.routePlan && <> · {bookingRouteDetails.route_type || "Custom Route"} · Priority {bookingRouteDetails.priority || "Normal"} · {bookingRouteSequence.length} planned points · Departs {formatRouteDate(bookingRouteDetails.schedule?.depart_at || booking.routePlan.plannedDeliveryDate || booking.routePlan.planned_delivery_date)}</>}</p>}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Parcels
                            </span>
                            <span className="text-xs font-bold text-slate-800">{parcelCount} Items</span>
                          </div>

                          <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Total Weight
                            </span>
                            <span className={`text-xs font-bold ${isOverCapacity ? "text-rose-600" : "text-slate-800"}`}>
                              {displayWeightKg} kg
                            </span>
                          </div>

                          <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Driver
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate block">
                              {booking.driverName || <span className="text-slate-400 italic font-normal">Unassigned</span>}
                            </span>
                          </div>

                          <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Vehicle Plate
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate block">
                              {booking.vehiclePlate || <span className="text-slate-400 italic font-normal">Unassigned</span>}
                            </span>
                          </div>

                          <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Courier
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate block">
                              {bookingCourier}
                            </span>
                          </div>
                        </div>

                        {/* Over Capacity Warning */}
                        {isOverCapacity && (
                          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                            <IconAlert className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>Weight ({displayWeightKg}kg) exceeds vehicle max payload ({vehicle?.capacityKg}kg)</span>
                          </div>
                        )}
                      </div>

                      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleGenerateAssignment(booking);
                          }}
                          disabled={loadingBookingId === booking.id}
                          className={`pointer-events-auto rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-lg transition flex items-center gap-2 ${
                            loadingBookingId === booking.id
                              ? "bg-rose-500 shadow-rose-500/20"
                              : "bg-rose-600 shadow-rose-600/20 hover:bg-rose-700"
                          }`}
                        >
                          {loadingBookingId === booking.id ? (
                            <>
                              <TruckLoadingAnimation size="w-4 h-4" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            "Generate Assignment"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedBookingId(booking.id);
                            setAssignmentStep("driver");
                            setIsDetailsModalOpen(true);
                          }}
                          className="pointer-events-auto rounded-xl border border-white/80 bg-white/80 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur-sm transition hover:bg-white"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Booking Details Modal */}
          {isDetailsModalOpen && selectedBooking && (
            <div
              className="fixed inset-0 z-[1099] flex items-start justify-center bg-slate-950/50 p-4 pt-24 sm:p-6 sm:pt-28"
              onMouseDown={() => setIsDetailsModalOpen(false)}
            >
              <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="dispatch-inspector-title"
                className="max-h-[calc(100vh-7rem)] w-full max-w-2xl overflow-y-auto"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                  overflow: "-moz-scrollbars-none",
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-lg space-y-6">
                  <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 block">
                        Assignment · {assignmentStep === "driver" ? "Step 1 of 2" : "Step 2 of 2"}
                      </span>
                      <h2 id="dispatch-inspector-title" className="text-lg font-extrabold text-slate-900">
                        {selectedBooking ? `Assign booking #${selectedBooking.id}` : "Select a Booking"}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                        {displayParcels.length} Parcels
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsDetailsModalOpen(false)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-lg leading-none text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        aria-label="Close details modal"
                      >
                        ×
                      </button>
                    </div>
                  </div>

              {selectedBooking ? (
                <>
                  {/* BOOKING DETAILS OVERVIEW */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Booking Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Booking ID */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Booking ID</span>
                        <span className="font-mono text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1.5 rounded-lg block truncate">
                          #{selectedBooking.id}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Status</span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                            selectedBooking.status === "DRIVER_VEHICLE_ASSIGNED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : selectedBooking.status === "DISPATCHED"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              selectedBooking.status === "DRIVER_VEHICLE_ASSIGNED"
                                ? "bg-emerald-500"
                                : selectedBooking.status === "DISPATCHED"
                                ? "bg-blue-500"
                                : "bg-amber-500"
                            }`}
                          />
                          {BOOKING_STATUS_LABEL[selectedBooking.status]}
                        </span>
                      </div>

                      {/* Created Date */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Created Date</span>
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <IconClock className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(selectedBooking.createdAt).toLocaleString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Route Plan Name */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Route Plan</span>
                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg block truncate">
                          {routePlanName(selectedBooking)}
                        </span>
                      </div>
                    </div>

                    {/* Route Information */}
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Route</span>
                      <div className="flex items-start gap-2">
                        <IconPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-700 leading-relaxed">{getBookingRouteLabel(selectedBooking, parcels)}</p>
                      </div>
                    </div>
                    {selectedRoutePlan && <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-bold text-slate-900">{selectedRouteDetails.route_name || selectedRoutePlan.route_name || "Route plan"}</h4><p className="mt-0.5 text-[10px] text-slate-500">{selectedRouteDetails.route_type || "Custom Route"} · Priority {selectedRouteDetails.priority || "Normal"}</p></div><span className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">{String(selectedRoutePlan.status || "Planned").replace(/_/g, " ")}</span></div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"><SummaryCard label="Distance" value={`${Number(selectedRoutePlan.optimizedDistanceKm ?? selectedRoutePlan.optimized_distance_km ?? selectedRoutePlan.distanceKm ?? selectedRoutePlan.distance_km ?? 0).toFixed(1)} km`} /><SummaryCard label="Travel time" value={`${Math.round(Number(selectedRoutePlan.optimizedDurationMinutes ?? selectedRoutePlan.optimized_duration_min ?? selectedRoutePlan.durationMinutes ?? selectedRoutePlan.estimated_duration_min ?? selectedRouteDetails.schedule?.duration_minutes ?? 0))} min`} /><SummaryCard label="Departure" value={formatRouteDate(selectedRouteDetails.schedule?.depart_at || selectedRoutePlan.plannedDeliveryDate || selectedRoutePlan.planned_delivery_date)} /><SummaryCard label="Expected arrival" value={formatRouteDate(selectedRouteDetails.schedule?.expected_arrival)} /><SummaryCard label="Vehicle class" value={selectedRouteDetails.vehicle_type || "Not specified"} /><SummaryCard label="Planned load" value={`${Number(selectedRouteDetails.estimated_load_kg || 0).toFixed(1)} kg`} /></div>
                      {(selectedRouteDetails.schedule?.window_start || selectedRouteDetails.schedule?.window_end) && <p className="text-[10px] text-slate-600"><b>Delivery window:</b> {formatRouteDate(selectedRouteDetails.schedule?.window_start)} – {formatRouteDate(selectedRouteDetails.schedule?.window_end)}</p>}
                      <div><h5 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Planned stop sequence</h5><ol className="space-y-2">{selectedRouteSequence.map((point, index) => <li key={`${point.id || point.name || point.address}-${index}`} className="flex gap-2 rounded-lg border border-slate-200 bg-white p-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[10px] font-bold text-rose-700">{index + 1}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{point.name || point.address || `Stop ${index + 1}`}{point.purpose ? <span className="font-normal text-slate-500"> · {point.purpose}</span> : null}</p>{point.address && <p className="mt-0.5 break-words text-[10px] text-slate-600">{point.address}</p>}<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500">{(point.lat ?? point.latitude) != null && (point.lng ?? point.longitude) != null && <span>{Number(point.lat ?? point.latitude).toFixed(5)}, {Number(point.lng ?? point.longitude).toFixed(5)}</span>}{point.arrival && <span>Arrive {formatRouteDate(point.arrival)}</span>}{point.departure && <span>Depart {formatRouteDate(point.departure)}</span>}{point.durationMinutes != null && <span>{point.durationMinutes} min stop</span>}</div>{point.instructions && <p className="mt-1 text-[10px] text-slate-600">{point.instructions}</p>}{point.parcelReference && <p className="mt-1 text-[10px] font-semibold text-rose-700">Parcels: {point.parcelReference}</p>}</div></li>)}</ol></div>
                      {selectedRouteDetails.notes && <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3"><h5 className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Route instructions</h5><p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{selectedRouteDetails.notes}</p></div>}
                    </div>}
                  </div>

                  {/* ASSIGNMENT DETAILS */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Assignment Details</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Driver */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Driver</span>
                        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                          selectedBooking.driverId
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-slate-100 border-slate-200"
                        }`}>
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[10px] shrink-0">
                            {selectedBooking.driverName?.slice(0, 2).toUpperCase() || "UN"}
                          </div>
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {selectedBooking.driverName || "Unassigned"}
                          </span>
                        </div>
                      </div>

                      {/* Vehicle */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Vehicle</span>
                        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
                          selectedBooking.vehicleId
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-slate-100 border-slate-200"
                        }`}>
                          <IconTruck className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {selectedBooking.vehiclePlate || "Unassigned"}
                          </span>
                        </div>
                      </div>

                      {/* Total Weight */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Weight</span>
                        <span className="text-xs font-bold text-slate-800 px-3 py-2 bg-slate-100 rounded-lg block">
                          {selectedBookingWeightKg} kg
                        </span>
                      </div>

                      {/* Parcel Count */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Parcels</span>
                        <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-100 rounded-lg">
                          <IconPackage className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">
                            {displayParcels.length} Items
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Capacity Meter */}
                    {selectedBooking.vehicleId && (
                      <div className="pt-2 border-t border-slate-200">
                        {(() => {
                          const veh = vehicles.find((v) => v.id === selectedBooking.vehicleId);
                          const cap = veh?.capacityKg || 1;
                          const ratio = Math.min(Math.round((selectedBookingWeightKg / cap) * 100), 100);
                          const isOver = selectedBookingWeightKg > cap;

                          return (
                            <div>
                              <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-slate-600">Payload vs Vehicle Capacity</span>
                                <span className={isOver ? "text-rose-600 font-black" : "text-slate-800"}>
                                  {selectedBookingWeightKg} / {cap} kg ({ratio}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    isOver ? "bg-rose-600" : ratio > 85 ? "bg-amber-500" : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${ratio}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Error Alert */}
                  {errorFor && errorFor.id === selectedBooking.id && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-start gap-2">
                      <IconAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{errorFor.message}</span>
                    </div>
                  )}

                  {/* Vehicle Capacity Meter */}
                  {selectedBooking.vehicleId && (
                    <div className="hidden bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                      {(() => {
                        const veh = vehicles.find((v) => v.id === selectedBooking.vehicleId);
                        const cap = veh?.capacityKg || 1;
                        const ratio = Math.min(Math.round((selectedBookingWeightKg / cap) * 100), 100);
                        const isOver = selectedBookingWeightKg > cap;

                        return (
                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1.5">
                              <span className="text-slate-600">Payload vs Vehicle Capacity</span>
                              <span className={isOver ? "text-rose-600 font-black" : "text-slate-800"}>
                                  {selectedBookingWeightKg} / {cap} kg ({ratio}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isOver ? "bg-rose-600" : ratio > 85 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* SECTION 1: DROP ASSIGNMENT TARGETS SECTION */}
                  <div className="hidden bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <IconSend className="w-3.5 h-3.5 text-rose-500" />
                        Assignment Drop Zone
                      </h3>
                      <span className="text-[10px] text-slate-400 font-medium">Drop Cards Here</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Driver Drop Target */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDriverOver(true);
                        }}
                        onDragLeave={() => setIsDriverOver(false)}
                        onDrop={() => {
                          setIsDriverOver(false);
                          if (draggedAssignment?.type === "driver") {
                            handleAssignDriver(selectedBooking.id, draggedAssignment.id);
                            setDraggedAssignment(null);
                          }
                        }}
                        className={`p-3 rounded-xl border-2 border-dashed transition-all duration-200 min-h-[90px] flex flex-col justify-center ${
                          isDriverOver
                            ? "border-rose-500 bg-rose-50/80 scale-[1.02]"
                            : selectedBooking.driverId
                            ? "border-emerald-300 bg-emerald-50/40"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {selectedBooking.driverId ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-xs shrink-0">
                                {selectedBooking.driverName?.slice(0, 2).toUpperCase() || "DR"}
                              </div>
                              <div className="truncate">
                                <h4 className="text-xs font-bold text-slate-900 truncate">{selectedBooking.driverName}</h4>
                                <span className="text-[10px] text-emerald-600 font-semibold block">Driver Assigned</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAssignDriver(selectedBooking.id, "")}
                              className="text-[10px] text-rose-600 hover:text-rose-700 font-bold px-2 py-1 rounded hover:bg-rose-50 transition"
                            >
                              Clear
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-xs text-slate-400 font-medium space-y-1">
                            <IconUser className="w-4 h-4 mx-auto text-slate-300" />
                            <span>Drop Driver Card</span>
                          </div>
                        )}
                      </div>

                      {/* Vehicle Drop Target */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsVehicleOver(true);
                        }}
                        onDragLeave={() => setIsVehicleOver(false)}
                        onDrop={() => {
                          setIsVehicleOver(false);
                          if (draggedAssignment?.type === "vehicle") {
                            handleAssignVehicle(selectedBooking.id, draggedAssignment.id);
                            setDraggedAssignment(null);
                          }
                        }}
                        className={`p-3 rounded-xl border-2 border-dashed transition-all duration-200 min-h-[90px] flex flex-col justify-center ${
                          isVehicleOver
                            ? "border-rose-500 bg-rose-50/80 scale-[1.02]"
                            : selectedBooking.vehicleId
                            ? "border-emerald-300 bg-emerald-50/40"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {selectedBooking.vehicleId ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-xs shrink-0">
                                <IconTruck className="w-4 h-4 text-emerald-700" />
                              </div>
                              <div className="truncate">
                                <h4 className="text-xs font-bold text-slate-900 truncate">{selectedBooking.vehiclePlate}</h4>
                                <span className="text-[10px] text-emerald-600 font-semibold block">Fleet Unit Assigned</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAssignVehicle(selectedBooking.id, "")}
                              className="text-[10px] text-rose-600 hover:text-rose-700 font-bold px-2 py-1 rounded hover:bg-rose-50 transition"
                            >
                              Clear
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-xs text-slate-400 font-medium space-y-1">
                            <IconTruck className="w-4 h-4 mx-auto text-slate-300" />
                            <span>Drop Vehicle Card</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>


                  {/* SECTION 4: PARCELS MANIFEST INSPECTOR */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconPackage className="w-3.5 h-3.5 text-rose-500" />
                      Payload Manifest ({displayParcels.length})
                    </h3>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {displayParcels.map((parcel) => (
                        <div key={parcel.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1 text-xs">
                          <div className="flex items-center justify-between font-mono font-bold text-slate-700">
                            <span>{parcel.trackingNumber}</span>
                            <span className="text-slate-500">{parcel.weightKg} kg</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><span className="font-semibold">{parcel.parcelType}</span><span className="rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-700">{String(parcel.status).replace(/_/g, " ")}</span>{parcel.courier && <span>{parcel.courier}</span>}</div>
                          <div className="text-slate-600 font-medium">
                            <span className="text-slate-400">To: </span>
                            {parcel.recipientName} ({parcel.destinationAddress})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION 5: DISPATCH ACTION BUTTON */}
                  <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                    {assignmentStep === "vehicle" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setAssignmentStep("driver")}
                          className="rounded-xl border border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => handleConfirm(selectedBooking)}
                          disabled={!selectedBooking.driverId || !selectedBooking.vehicleId || dispatchingBookingId === selectedBooking.id}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          {dispatchingBookingId === selectedBooking.id ? (
                            <>
                              <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                              Assigning Pickup...
                            </>
                          ) : (
                            <>
                              <IconSend className="w-4 h-4" />
                              Assign for Pickup
                            </>
                          )}
                        </button>
                      </>
                    ) : assignmentStep === "driver" ? (
                      <button
                        type="button"
                        onClick={() => setAssignmentStep("vehicle")}
                        disabled={!selectedBooking.driverId}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        Next: Assign Vehicle
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                      </button>
                    ) : null}
                  </div>
                </>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs italic">
                    Select a booking from the list to manage assignments and review payload.
                  </div>
                )}
                </div>
              </aside>
            </div>
          )}
        </div>
        </div>
        </div>

        {selectedResource && (() => {
          const { category, resource } = selectedResource;
          const status = resourceStatus(resource, category, bookings, resourceTrips);
          const assignedVehicleId = String(resourceValue(resource, "vehicle_id", "vehicleId") || "");
          const assignedVehicle = resourceVehicles.find((vehicle) => vehicle.id === assignedVehicleId);
          const title = category === "vehicles"
            ? String(resourceValue(resource, "plate_number", "plate", "plateNumber") || resource.id)
            : String(resourceValue(resource, "full_name", "name") || resource.id);
          const details: Array<[string, string]> = category === "vehicles" ? [
            ["Vehicle ID", resource.id],
            ["Plate number", resourceDisplayValue(resourceValue(resource, "plate_number", "plate", "plateNumber"))],
            ["Model", resourceDisplayValue(resourceValue(resource, "model", "vehicle_model"))],
            ["Make", resourceDisplayValue(resourceValue(resource, "make", "manufacturer"))],
            ["Type", resourceDisplayValue(resourceValue(resource, "vehicle_type", "type", "vehicleType"))],
            ["Capacity", resourceValue(resource, "capacity_kg", "capacityKg", "capacity") == null ? "Not recorded" : `${resourceValue(resource, "capacity_kg", "capacityKg", "capacity")} kg`],
            ["Status", status],
            ["Availability", resourceDisplayValue(resourceValue(resource, "availability", "assignment_status"))],
            ["Courier", resourceDisplayValue(resourceValue(resource, "courier", "courier_name"))],
            ["Fuel efficiency", resourceValue(resource, "fuel_efficiency", "fuelEfficiencyKmPerL") == null ? "Not recorded" : `${resourceValue(resource, "fuel_efficiency", "fuelEfficiencyKmPerL")} km/L`],
            ["Mileage", resourceDisplayValue(resourceValue(resource, "mileage", "odometer"))],
            ["Last service", resourceDisplayValue(resourceValue(resource, "last_service", "lastService"))],
            ["Next service", resourceDisplayValue(resourceValue(resource, "next_service", "nextService"))],
          ] : [
            ["Driver ID", resource.id],
            ["Name", resourceDisplayValue(resourceValue(resource, "full_name", "name"))],
            ["Email", resourceDisplayValue(resourceValue(resource, "email"))],
            ["Phone", resourceDisplayValue(resourceValue(resource, "phone", "phone_number"))],
            ["License number", resourceDisplayValue(resourceValue(resource, "license_number", "licenseNumber", "driver_license_number"))],
            ["License expiry", resourceDisplayValue(resourceValue(resource, "license_expiration", "license_expiry", "licenseExpiry"))],
            ["Availability", status],
            ["Courier", resourceDisplayValue(resourceValue(resource, "courier", "courier_name"))],
            ["Assigned vehicle", assignedVehicle ? String(resourceValue(assignedVehicle, "plate_number", "plate", "plateNumber") || assignedVehicle.id) : assignedVehicleId || "Not assigned"],
            ["Joined", formatRouteDate(String(resourceValue(resource, "created_at", "createdAt") || ""))],
          ];
          return <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedResource(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="resource-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-rose-100 bg-white p-5 shadow-2xl sm:p-6">
              <header className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${category === "vehicles" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{category === "vehicles" ? <IconTruck className="h-5 w-5" /> : <IconUser className="h-5 w-5" />}</div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">{category === "vehicles" ? "Vehicle details" : "Driver details"}</p><h2 id="resource-detail-title" className="truncate text-lg font-bold text-slate-900">{title}</h2></div></div><button type="button" onClick={() => setSelectedResource(null)} aria-label="Close resource details" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50">×</button></header>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{details.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-100 bg-rose-50/30 px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words text-xs font-semibold text-slate-800">{value}</p></div>)}</div>
            </section>
          </div>;
        })()}

        {/* Assignment Error Modal */}
        {loadingBookingId && (
          <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm" role="status" aria-live="polite" aria-label="Generating assignment">
            <div className="w-full max-w-sm rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <TruckLoadingAnimation size="h-10 w-10" />
              </div>
              <h2 className="mt-5 text-lg font-black text-slate-900">Generating Assignment</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Saving the driver and vehicle assignment for booking #{loadingBookingId}.
              </p>
              <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-rose-100">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-rose-600" />
              </div>
            </div>
          </div>
        )}

        {assignmentErrorModal.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onMouseDown={() => setAssignmentErrorModal({ isOpen: false, message: "" })}
          >
            <div
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 rounded-full">
                  <IconAlert className="w-6 h-6 text-rose-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Assignment Failed</h2>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{assignmentErrorModal.message}</p>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setAssignmentErrorModal({ isOpen: false, message: "" })}
                  className="flex-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <GlobalFooter />
    </div>
  );
}
