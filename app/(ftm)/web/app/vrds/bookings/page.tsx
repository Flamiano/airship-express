"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import { SkeletonTable } from "../../components/PageSkeleton";
import {
  useParcelStore,
  assignDriver,
  assignVehicle,
  assignDriverAndVehicle,
  confirmDispatch,
} from "../../lib/parcelStore";
import { Booking, BOOKING_STATUS_LABEL } from "../../lib/parcelTypes";
import { createTrip, getRoutePlan } from "../../lib/api";

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

export default function VrdsBookingsPage() {
  const router = useRouter();
  const { bookings, parcels, drivers, vehicles, ready } = useParcelStore();

  const availableDrivers = useMemo(
    () => drivers.filter((driver) => driver.status === "Available"),
    [drivers]
  );
  const availableVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === "Available"),
    [vehicles]
  );

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [loadingBookingId, setLoadingBookingId] = useState<string | null>(null);
  const [assignmentStep, setAssignmentStep] = useState<"driver" | "vehicle">("driver");
  const [toast, setToast] = useState<string | null>(null);
  const [errorFor, setErrorFor] = useState<{ id: string; message: string } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("All");
  const [draggedAssignment, setDraggedAssignment] = useState<{
    type: "driver" | "vehicle";
    id: string;
  } | null>(null);
  const [isDriverOver, setIsDriverOver] = useState(false);
  const [isVehicleOver, setIsVehicleOver] = useState(false);

  const openBookings = useMemo(
    () => bookings.filter((b) => b.status === "PENDING" || b.status === "DRIVER_VEHICLE_ASSIGNED"),
    [bookings]
  );

  const getBookingRouteLabel = (booking: Booking, parcelList: typeof parcels = parcels) => {
    const genericLabelPattern = /selected delivery destinations|route preview|airship express hub.*binondo/i;
    const normalized = booking.routeLabel || "";
    if (!genericLabelPattern.test(normalized)) {
      return normalized || "Airship Express Hub - Binondo, Manila";
    }

    const routeParcels = parcelList.filter((parcel) => parcel.bookingId === booking.id);
    const addresses = routeParcels
      .map((parcel) => parcel.destinationAddress)
      .filter((value): value is string => Boolean(value && value.trim()));

    if (addresses.length > 0) {
      return `Airship Express Hub - Binondo, Manila → ${addresses.slice(0, 3).join(" • ")}`;
    }

    return "Airship Express Hub - Binondo, Manila → Route destinations";
  };

  const filteredBookings = useMemo(() => {
    return openBookings.filter((booking) => {
      const matchesStatus = statusFilter === "All" || booking.status === statusFilter;
      const routeLabel = getBookingRouteLabel(booking, parcels);
      const matchesSearch =
        searchText.trim().length === 0 ||
        [booking.id, routeLabel, booking.driverName ?? "", booking.vehiclePlate ?? ""].some(
          (value) => value.toLowerCase().includes(searchText.toLowerCase())
        );
      return matchesStatus && matchesSearch;
    });
  }, [openBookings, parcels, searchText, statusFilter]);

  const bookingsById = useMemo(
    () => Object.fromEntries(openBookings.map((booking) => [booking.id, booking])) as Record<string, Booking>,
    [openBookings]
  );

  const selectedBooking = selectedBookingId ? bookingsById[selectedBookingId] : null;

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

  const handleGenerateAssignment = (booking: Booking) => {
    const driver = availableDrivers[0];
    const vehicle = availableVehicles
      .filter((item) => item.capacityKg >= booking.totalWeightKg)
      .sort((a, b) => a.capacityKg - b.capacityKg)[0];

    if (!driver || !vehicle) {
      setErrorFor({
        id: booking.id,
        message: !driver
          ? "No available driver can be assigned right now."
          : "No available vehicle has enough capacity for this booking.",
      });
      return;
    }

    // Start loading animation
    setLoadingBookingId(booking.id);

    // Simulate processing time for animation
    setTimeout(() => {
      assignDriverAndVehicle(booking.id, driver.id, vehicle.id);
      setErrorFor(null);
      setAssignmentStep("vehicle");
      setLoadingBookingId(null);
      showToast(`Suggested ${driver.name} with ${vehicle.plateNumber}. Review and dispatch when ready.`);
    }, 1200);
  };

  const handleConfirm = async (booking: Booking) => {
    const selectedBookingParcels = parcels.filter((parcel) => parcel.bookingId === booking.id);
    const destinationParcel = selectedBookingParcels[0];
    const driver = drivers.find((item) => item.id === booking.driverId);

    if (!booking.driverId || !booking.vehicleId) {
      setErrorFor({ id: booking.id, message: "Assign both a driver and a vehicle before dispatching." });
      return;
    }

    const routePlanId = booking.routePlanId || selectedBookingParcels.find((p: any) => p.routePlanId)?.routePlanId;
    let planStops: { name: string; lat: number; lng: number }[] = [];
    let planPickup: { label?: string; lat?: number; lng?: number } | null = null;

    if (routePlanId) {
      try {
        const plan = await getRoutePlan(routePlanId);
        const dests = Array.isArray(plan?.deliveryDestinations) ? plan.deliveryDestinations : [];
        planStops = dests
          .map((d: any) => ({
            name: d.name || d.label || "Stop",
            lat: Number(d.lat ?? d.latitude),
            lng: Number(d.lng ?? d.longitude),
          }))
          .filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
        if (plan?.pickupLocation) {
          planPickup = { label: plan.pickupLocation, lat: Number(plan.pickupLatitude), lng: Number(plan.pickupLongitude) };
        }
      } catch (err) {
        console.warn(`Unable to load route plan ${routePlanId}; falling back to single destination.`, err);
      }
    }

    const finalStop = planStops[planStops.length - 1];
    const fromLocation = planPickup?.label || "Airship Express Hub - Binondo, Manila";
    const fromLat = planPickup?.lat || 14.5995;
    const fromLng = planPickup?.lng || 120.9745;

    try {
      await createTrip({
        id: `TRIP-${booking.id}`,
        booking_id: booking.id,
        driver_id: booking.driverId,
        driver_name: driver?.name || booking.driverName,
        vehicle_id: booking.vehicleId,
        from_location: fromLocation,
        to_location: finalStop?.name || getBookingRouteLabel(booking, parcels),
        from_latitude: fromLat,
        from_longitude: fromLng,
        to_latitude: finalStop?.lat || destinationParcel?.destLat || 0,
        to_longitude: finalStop?.lng || destinationParcel?.destLng || 0,
        status: "In Transit",
        progress: 5,
        load_kg: booking.totalWeightKg,
        stops: planStops,
      });

      const result = confirmDispatch(booking.id);
      if (!result.ok) {
        setErrorFor({ id: booking.id, message: result.reason || "Unable to dispatch booking." });
        return;
      }
    } catch (error) {
      setErrorFor({
        id: booking.id,
        message: error instanceof Error ? error.message : "Unable to create delivery trip.",
      });
      return;
    }

    setErrorFor(null);
    showToast(`Booking ${booking.id} successfully dispatched!`);

    setTimeout(() => {
      router.push(`/vrds/missions?dispatch=${booking.id}`);
    }, 500);
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
          courier: undefined as any,
          weightKg: Math.round((selectedBooking!.totalWeightKg / syntheticCount) * 10) / 10,
          notes: undefined,
          status: "RECEIVED" as const,
          receivedAt: new Date().toISOString(),
          bookingId: selectedBooking!.id,
        }))
      : [];

  const displayParcels =
    selectedParcels.length > 0 ? selectedParcels : fallbackParcels.length > 0 ? fallbackParcels : syntheticParcels;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-800 antialiased selection:bg-rose-500 selection:text-white">
      <GlobalNavbar />

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

        {/* Master / Detail Split Grid */}
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
                  const isOverCapacity = vehicle ? booking.totalWeightKg > vehicle.capacityKg : false;

                  const currentBookingParcels = parcels.filter((p) => p.bookingId === booking.id);
                  const parcelCount = currentBookingParcels.length || booking.parcelIds.length || booking.parcelCount || 0;

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
                              #{booking.id}
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
                              {booking.totalWeightKg} kg
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
                        </div>

                        {/* Over Capacity Warning */}
                        {isOverCapacity && (
                          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                            <IconAlert className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>Weight ({booking.totalWeightKg}kg) exceeds vehicle max payload ({vehicle?.capacityKg}kg)</span>
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 sm:p-6"
              onMouseDown={() => setIsDetailsModalOpen(false)}
            >
              <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="dispatch-inspector-title"
                className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto"
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

                      {/* Route Plan ID */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Route Plan ID</span>
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg block truncate">
                          {selectedBooking.routePlanId || "N/A"}
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
                          {selectedBooking.totalWeightKg} kg
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
                          const ratio = Math.min(Math.round((selectedBooking.totalWeightKg / cap) * 100), 100);
                          const isOver = selectedBooking.totalWeightKg > cap;

                          return (
                            <div>
                              <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-slate-600">Payload vs Vehicle Capacity</span>
                                <span className={isOver ? "text-rose-600 font-black" : "text-slate-800"}>
                                  {selectedBooking.totalWeightKg} / {cap} kg ({ratio}%)
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

                  <button
                    type="button"
                    onClick={() => handleGenerateAssignment(selectedBooking)}
                    disabled={loadingBookingId === selectedBooking.id}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
                      loadingBookingId === selectedBooking.id
                        ? "border border-rose-200 bg-rose-50 text-rose-600 opacity-75"
                        : "border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                    }`}
                  >
                    {loadingBookingId === selectedBooking.id ? (
                      <>
                        <TruckLoadingAnimation size="w-5 h-5" />
                        <span>Generating Assignment...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                        Generate Assignment
                      </>
                    )}
                  </button>

                  {/* Vehicle Capacity Meter */}
                  {selectedBooking.vehicleId && (
                    <div className="hidden bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                      {(() => {
                        const veh = vehicles.find((v) => v.id === selectedBooking.vehicleId);
                        const cap = veh?.capacityKg || 1;
                        const ratio = Math.min(Math.round((selectedBooking.totalWeightKg / cap) * 100), 100);
                        const isOver = selectedBooking.totalWeightKg > cap;

                        return (
                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1.5">
                              <span className="text-slate-600">Payload vs Vehicle Capacity</span>
                              <span className={isOver ? "text-rose-600 font-black" : "text-slate-800"}>
                                {selectedBooking.totalWeightKg} / {cap} kg ({ratio}%)
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

                  {/* SECTION 2: DRIVERS POOL SECTION */}
                  <div className={assignmentStep === "driver" ? "space-y-2.5" : "hidden"}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <IconUser className="w-3.5 h-3.5 text-indigo-500" />
                        Available Drivers ({availableDrivers.length})
                      </h3>
                      <span className="text-[10px] text-slate-400">Select a driver</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {availableDrivers.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic text-center py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No drivers available in pool
                        </p>
                      ) : (
                        availableDrivers.map((driver) => {
                          const isAssigned = selectedBooking.driverId === driver.id;
                          return (
                            <div
                              key={driver.id}
                              onClick={() => handleAssignDriver(selectedBooking.id, isAssigned ? "" : driver.id)}
                              className={`min-w-0 cursor-pointer rounded-xl border p-2.5 transition text-xs ${
                                isAssigned
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                                  : "bg-white border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600">
                                  {driver.name.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="truncate font-semibold text-slate-800">{driver.name}</span>
                              </div>
                              <span className="mt-2 inline-flex text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                {isAssigned ? "Remove" : "Select"}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* SECTION 3: FLEET VEHICLES POOL SECTION */}
                  <div className={assignmentStep === "vehicle" ? "space-y-2.5" : "hidden"}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <IconTruck className="w-3.5 h-3.5 text-amber-500" />
                        Available Vehicles ({availableVehicles.length})
                      </h3>
                      <span className="text-[10px] text-slate-400">Select a vehicle</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {availableVehicles.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic text-center py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No fleet vehicles available in pool
                        </p>
                      ) : (
                        availableVehicles.map((vehicle) => {
                          const isAssigned = selectedBooking.vehicleId === vehicle.id;
                          return (
                            <div
                              key={vehicle.id}
                              onClick={() => handleAssignVehicle(selectedBooking.id, isAssigned ? "" : vehicle.id)}
                              className={`min-w-0 cursor-pointer rounded-xl border p-2.5 transition text-xs ${
                                isAssigned
                                  ? "bg-amber-50 border-amber-200 text-amber-900"
                                  : "bg-white border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <IconTruck className="w-4 h-4 text-slate-400" />
                                <div className="min-w-0">
                                  <span className="block truncate font-bold text-slate-800">{vehicle.plateNumber}</span>
                                  <span className="block truncate text-[10px] text-slate-400">{vehicle.model} ({vehicle.capacityKg}kg cap)</span>
                                </div>
                              </div>
                              <span className="mt-2 inline-flex text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                {isAssigned ? "Remove" : "Select"}
                              </span>
                            </div>
                          );
                        })
                      )}
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
                    {assignmentStep === "vehicle" && (
                      <button
                        type="button"
                        onClick={() => setAssignmentStep("driver")}
                        className="rounded-xl border border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                      >
                        Back
                      </button>
                    )}
                    {assignmentStep === "driver" ? (
                      <button
                        type="button"
                        onClick={() => setAssignmentStep("vehicle")}
                        disabled={!selectedBooking.driverId}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        Next: Assign Vehicle
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConfirm(selectedBooking)}
                        disabled={!selectedBooking.driverId || !selectedBooking.vehicleId}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        <IconSend className="w-4 h-4" />
                        Authorize & Dispatch
                      </button>
                    )}
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
      </main>

      <GlobalFooter />
    </div>
  );
}
