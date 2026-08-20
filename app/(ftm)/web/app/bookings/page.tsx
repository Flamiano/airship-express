"use client";

import { useMemo, useState } from "react";
import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";
import {
  useParcelStore,
  assignDriver,
  assignVehicle,
  cancelBooking,
  confirmDispatch,
} from "../lib/parcelStore";
import { Booking, BOOKING_STATUS_LABEL } from "../lib/parcelTypes";
import { createTrip, getRoutePlans, getRoutePlan } from "../lib/api";

const STATUS_OPTIONS = ["All", "PENDING", "DRIVER_VEHICLE_ASSIGNED"] as const;
type BookingStatusFilter = (typeof STATUS_OPTIONS)[number];

export default function VrdsBookingsPage() {
  const { bookings, parcels, drivers, vehicles, ready } = useParcelStore();
  const availableDrivers = drivers.filter((driver) => driver.status === "Available");
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === "Available");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorFor, setErrorFor] = useState<{ id: string; message: string } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("All");

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

  const selectedBooking = selectedBookingId ? bookingsById[selectedBookingId] : filteredBookings[0] ?? null;

  const pendingAssignments = openBookings.filter((booking) => !booking.driverId || !booking.vehicleId).length;
  const assignedBookings = openBookings.filter((booking) => booking.driverId && booking.vehicleId).length;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const handleAssignDriver = (bookingId: string, driverId: string) => {
    assignDriver(bookingId, driverId);
    showToast(`Driver updated for ${bookingId}`);
  };

  const handleAssignVehicle = (bookingId: string, vehicleId: string) => {
    assignVehicle(bookingId, vehicleId);
    showToast(`Vehicle updated for ${bookingId}`);
  };

  const handleConfirm = async (booking: Booking) => {
    const selectedBookingParcels = parcels.filter((parcel) => parcel.bookingId === booking.id);
    const destinationParcel = selectedBookingParcels[0];
    const driver = drivers.find((item) => item.id === booking.driverId);
    const vehicle = vehicles.find((item) => item.id === booking.vehicleId);

    if (!booking.driverId || !booking.vehicleId) {
      setErrorFor({ id: booking.id, message: "Assign both a driver and a vehicle before dispatch." });
      return;
    }

    // If this booking's parcels came from an OR-Tools-optimized Route Plan
    // (bulk parcels for one courier across several city warehouses), pull
    // that plan's ordered stop sequence so the trip carries every waypoint
    // — not just the first parcel's destination.
    const routePlanId = selectedBookingParcels.find((p: any) => p.routePlanId)?.routePlanId;
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
        console.warn(`Unable to load route plan ${routePlanId} for booking ${booking.id}; falling back to single-destination trip.`, err);
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
        // Full ordered waypoint list (courier warehouses this bulk route
        // visits) — persisted to trip_stops and picked up by Active
        // Deliveries for multi-stop tracking.
        stops: planStops,
      });

      const result = confirmDispatch(booking.id);
      if (!result.ok) {
        setErrorFor({ id: booking.id, message: result.reason || "Unable to dispatch booking." });
        return;
      }
    } catch (error) {
      setErrorFor({ id: booking.id, message: error instanceof Error ? error.message : "Unable to create delivery trip." });
      return;
    }

    setErrorFor(null);
    showToast(`Booking ${booking.id} dispatched. Parcels are now in transit.`);
  };

  const selectedParcels = selectedBooking
    ? parcels.filter((parcel) => parcel.bookingId === selectedBooking.id)
    : [];

  // Fallback 1: if no parcels found by bookingId but booking has parcelIds, try to lookup by ID
  const fallbackParcels = selectedBooking && selectedParcels.length === 0 && selectedBooking.parcelIds.length > 0
    ? selectedBooking.parcelIds
        .map(parcelId => parcels.find(p => String(p.id) === String(parcelId)))
        .filter((p): p is typeof parcels[0] => p !== undefined)
    : [];

  // Fallback 2: if still no parcels, create synthetic placeholders from parcelIds or parcelCount
  const syntheticCount = selectedBooking && selectedParcels.length === 0 && fallbackParcels.length === 0 
    ? (selectedBooking.parcelIds?.length || selectedBooking.parcelCount || 0)
    : 0;
    
  const syntheticParcels = syntheticCount > 0
    ? Array.from({ length: syntheticCount }, (_, i) => ({
        id: `${selectedBooking!.id}-parcel-${i + 1}`,
        trackingNumber: "",
        senderName: "Unknown",
        senderPhone: "",
        recipientName: "Unknown",
        recipientPhone: "",
        destinationAddress: "",
        destLat: 0,
        destLng: 0,
        parcelType: "E-commerce Package" as const,
        courier: undefined as any,
        weightKg: 0,
        notes: undefined,
        status: "RECEIVED" as const,
        receivedAt: new Date().toISOString(),
        bookingId: selectedBooking!.id,
      }))
    : [];

  // Use whatever parcels we have: real parcels by bookingId, by ID lookup, or synthetic placeholders
  const displayParcels = selectedParcels.length > 0 ? selectedParcels : (fallbackParcels.length > 0 ? fallbackParcels : syntheticParcels);

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-inherit antialiased">
      <GlobalNavbar />

      {/* Main Container - Full Width Expansion */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        
        {/* Header Banner */}
        <section className="bg-white border border-rose-100 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-xs font-bold tracking-wider uppercase text-rose-600">
                  VRDS Dispatch Control
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Dispatch-Ready Bookings
              </h1>
              <p className="mt-1 text-sm text-slate-500 max-w-3xl">
                Assign available drivers and fleet vehicles, inspect weight loads, and authorize outbound shipments from the Binondo Hub.
              </p>
            </div>

            {/* Hub Quick Stats Badges */}
            <div className="flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2 bg-pink-50/60 border border-pink-100 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-700">
                <IconTruck className="w-4 h-4 text-rose-500" />
                <span>Total Active:</span>
                <strong className="text-slate-900 font-bold">{openBookings.length}</strong>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/80 rounded-lg px-3.5 py-2 text-xs font-medium text-amber-800">
                <IconAlert className="w-4 h-4 text-amber-600" />
                <span>Needs Assignment:</span>
                <strong className="text-amber-900 font-bold">{pendingAssignments}</strong>
              </div>
            </div>
          </div>

          {/* Metric Dashboard Cards */}
          <div className="mt-6 grid gap-4 grid-cols-2 md:grid-cols-4">
            <MetricCard
              label="Open Bookings"
              value={openBookings.length}
              subtext="In staging queue"
              icon={<IconPackage className="w-5 h-5 text-rose-600" />}
              bgColor="bg-pink-100/60"
            />
            <MetricCard
              label="Ready for Dispatch"
              value={assignedBookings}
              subtext="Driver & vehicle assigned"
              icon={<IconCheck className="w-5 h-5 text-emerald-600" />}
              bgColor="bg-emerald-50"
            />
            <MetricCard
              label="Available Drivers"
              value={availableDrivers.length}
              subtext="Ready for dispatch"
              icon={<IconDriver className="w-5 h-5 text-pink-600" />}
              bgColor="bg-rose-50"
            />
            <MetricCard
              label="Available Fleet"
              value={availableVehicles.length}
              subtext="Ready for dispatch"
              icon={<IconTruck className="w-5 h-5 text-fuchsia-600" />}
              bgColor="bg-fuchsia-50"
            />
          </div>
        </section>

        {/* Master / Detail Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12 items-start">
          
          {/* LEFT: Booking Queue List */}
          <section className="lg:col-span-7 xl:col-span-8 2xl:col-span-9 bg-white border border-rose-100 rounded-2xl p-5 shadow-xs space-y-5">
            {/* Queue Header & Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-rose-100/80 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Active Queue</h2>
                <p className="text-xs text-slate-500">Select a shipment to configure or dispatch</p>
              </div>

              {/* Search & Filter Inputs */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-72">
                  <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search route, driver, ID, or plate..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-rose-50/40 border border-rose-100 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as BookingStatusFilter)}
                  className="py-1.5 px-3 text-xs bg-rose-50/40 border border-rose-100 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition text-slate-700 font-medium"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "All" ? "All Statuses" : BOOKING_STATUS_LABEL[option] || option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List Content */}
            {!ready ? (
              <div className="py-16 text-center text-rose-400 text-sm">
                <span className="inline-block animate-spin mr-2">🌸</span> Loading bookings queue...
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="py-16 text-center rounded-xl border border-dashed border-rose-200 bg-pink-50/30 p-6">
                <IconPackage className="w-8 h-8 text-rose-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No bookings found</p>
                <p className="text-xs text-slate-500 mt-1">Try clearing your search query or changing filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookings.map((booking) => {
                  const bookingParcels = parcels.filter((p) => p.bookingId === booking.id);
                  const fallbackBookingParcels = bookingParcels.length === 0 && booking.parcelIds.length > 0
                    ? booking.parcelIds
                        .map(parcelId => parcels.find(p => String(p.id) === String(parcelId)))
                        .filter((p): p is typeof parcels[0] => p !== undefined)
                    : [];
                  const displayBookingParcels = bookingParcels.length > 0 ? bookingParcels : fallbackBookingParcels;
                  
                  const isSelected = selectedBooking?.id === booking.id;
                  const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
                  const overCapacity = vehicle ? booking.totalWeightKg > vehicle.capacityKg : false;

                  return (
                    <div
                      key={booking.id}
                      onClick={() => setSelectedBookingId(booking.id)}
                      className={`group relative cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                        isSelected
                          ? "border-rose-500 bg-pink-50/40 ring-1 ring-rose-500 shadow-xs"
                          : "border-rose-100/80 bg-white hover:border-pink-300 hover:shadow-xs"
                      }`}
                    >
                      {/* Top Row: ID, Route, Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-rose-600 bg-pink-50 px-2 py-0.5 rounded border border-pink-100">
                              {booking.id}
                            </span>
                            <span className="text-xs text-slate-300">•</span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <IconCalendar className="w-3.5 h-3.5 text-rose-400" />
                              {new Date(booking.createdAt).toLocaleString("en-PH", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <h3 className="mt-1.5 text-sm font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                            {getBookingRouteLabel(booking, parcels)}
                          </h3>
                        </div>

                        {/* Status Tag */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            booking.status === "DRIVER_VEHICLE_ASSIGNED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : "bg-amber-50 text-amber-700 border border-amber-200/60"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              booking.status === "DRIVER_VEHICLE_ASSIGNED" ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          {BOOKING_STATUS_LABEL[booking.status]}
                        </span>
                      </div>

                      {/* Detail Pill Badges */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-pink-50/40 p-2.5 rounded-lg border border-pink-100/60">
                          <span className="text-rose-400 block text-[10px] uppercase font-bold">Parcels</span>
                          <span className="font-medium text-slate-800">{displayBookingParcels.length || booking.parcelIds.length || booking.parcelCount || 0} items</span>
                        </div>
                        <div className="bg-pink-50/40 p-2.5 rounded-lg border border-pink-100/60">
                          <span className="text-rose-400 block text-[10px] uppercase font-bold">Total Load</span>
                          <span className={`font-medium ${overCapacity ? "text-rose-600 font-bold" : "text-slate-800"}`}>
                            {booking.totalWeightKg} kg
                          </span>
                        </div>
                        <div className="bg-pink-50/40 p-2.5 rounded-lg border border-pink-100/60">
                          <span className="text-rose-400 block text-[10px] uppercase font-bold">Driver</span>
                          <span className="font-medium text-slate-800 truncate block">
                            {booking.driverName || <span className="text-slate-400 italic">Unassigned</span>}
                          </span>
                        </div>
                        <div className="bg-pink-50/40 p-2.5 rounded-lg border border-pink-100/60">
                          <span className="text-rose-400 block text-[10px] uppercase font-bold">Vehicle Plate</span>
                          <span className="font-medium text-slate-800 truncate block">
                            {booking.vehiclePlate || <span className="text-slate-400 italic">Unassigned</span>}
                          </span>
                        </div>
                      </div>

                      {/* Over Capacity Warning Indicator */}
                      {overCapacity && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                          <IconAlert className="w-4 h-4 shrink-0" />
                          <span>Weight ({booking.totalWeightKg}kg) exceeds vehicle capacity ({vehicle?.capacityKg}kg)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT: Sticky Detail Sidebar */}
          <aside className="lg:col-span-5 xl:col-span-4 2xl:col-span-3 sticky top-6 space-y-5">
            <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-xs space-y-5">
              
              {/* Header */}
              <div className="border-b border-rose-100/80 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-rose-400">Selected Booking</span>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedBooking ? selectedBooking.id : "No selection"}
                  </h3>
                </div>
                {selectedBooking && (
                  <span className="text-xs bg-pink-50 text-rose-700 border border-pink-100 px-2.5 py-1 rounded-full font-medium">
                    {displayParcels.length || selectedBooking.parcelIds.length || selectedBooking.parcelCount || 0} Parcels
                  </span>
                )}
              </div>

              {selectedBooking ? (
                <>
                  {/* Route & Metadata Overview */}
                  <div className="bg-pink-50/40 border border-pink-100/80 rounded-xl p-3.5 space-y-2">
                    <p className="text-xs text-slate-500 font-medium">Route Target</p>
<p className="text-sm font-bold text-slate-900">{selectedBooking ? getBookingRouteLabel(selectedBooking, parcels) : "No selection"}</p>
                    
                    {/* Vehicle Weight Capacity Progress Bar */}
                    {selectedBooking.vehicleId && (
                      <div className="pt-2 border-t border-rose-100 mt-2">
                        {(() => {
                          const veh = vehicles.find((v) => v.id === selectedBooking.vehicleId);
                          const cap = veh?.capacityKg || 1;
                          const ratio = Math.min(Math.round((selectedBooking.totalWeightKg / cap) * 100), 100);
                          const isOver = selectedBooking.totalWeightKg > cap;

                          return (
                            <div>
                              <div className="flex justify-between text-xs font-medium mb-1">
                                <span className="text-slate-500">Vehicle Capacity Load</span>
                                <span className={isOver ? "text-rose-600 font-bold" : "text-slate-700"}>
                                  {selectedBooking.totalWeightKg} / {cap} kg ({ratio}%)
                                </span>
                              </div>
                              <div className="w-full bg-rose-100/80 h-2 rounded-full overflow-hidden">
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

                  {/* Assignment Controls */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Assignments</p>

                    <DriverVehicleSelect
                      label="Assigned Driver"
                      value={selectedBooking.driverId || ""}
                      options={availableDrivers}
                      placeholder="Select available driver..."
                      onChange={(val) => handleAssignDriver(selectedBooking.id, val)}
                      currentLabel={selectedBooking.driverName}
                    />

                    <DriverVehicleSelect
                      label="Assigned Vehicle"
                      value={selectedBooking.vehicleId || ""}
                      options={availableVehicles}
                      placeholder="Select available vehicle..."
                      onChange={(val) => handleAssignVehicle(selectedBooking.id, val)}
                      currentLabel={selectedBooking.vehiclePlate}
                    />
                  </div>

                  {/* Parcels Manifest Preview */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                      Parcel Breakdown ({displayParcels.length || selectedBooking.parcelIds.length || selectedBooking.parcelCount || 0})
                    </p>
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 text-xs">
                      {displayParcels.length === 0 ? (
                        <p className="text-slate-400 italic py-1">No parcels associated with this booking.</p>
                      ) : (
                        displayParcels.map((parcel) => (
                          <div
                            key={parcel.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-pink-50/30 border border-pink-100/60 text-slate-700"
                          >
                            <span className="font-mono text-[11px] font-semibold text-rose-900">{parcel.id}</span>
                            <span className="text-slate-500">{parcel.weightKg} kg</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Error Alert Box */}
                  {errorFor?.id === selectedBooking.id && (
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">
                      <IconAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorFor.message}</span>
                    </div>
                  )}

                  {/* CTA Actions */}
                  <div className="pt-2 border-t border-rose-100/80 flex flex-col gap-2">
                    <button
                      onClick={() => handleConfirm(selectedBooking)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white py-2.5 px-4 text-xs font-bold transition shadow-xs"
                    >
                      <IconCheck className="w-4 h-4" />
                      Start Dispatch (In Transit)
                    </button>

                    <button
                      onClick={() => {
                        cancelBooking(selectedBooking.id);
                        setSelectedBookingId(null);
                        showToast(`Booking ${selectedBooking.id} has been cancelled.`);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white hover:bg-pink-50/50 text-slate-600 py-2.5 px-4 text-xs font-semibold transition"
                    >
                      Cancel Booking
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Click any booking card from the active queue to view assignment details and dispatch options.
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <GlobalFooter />

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-xl shadow-xl border border-slate-800 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-pink-400"></span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

{/* Sub-components */}

function MetricCard({
  label,
  value,
  subtext,
  icon,
  bgColor,
}: {
  label: string;
  value: number;
  subtext: string;
  icon: React.ReactNode;
  bgColor: string;
}) {
  return (
    <div className="bg-white border border-rose-100 rounded-xl p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{subtext}</p>
    </div>
  );
}

function DriverVehicleSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  currentLabel,
}: {
  label: string;
  value: string;
  options: { id: string; name?: string; plate?: string }[];
  placeholder: string;
  onChange: (value: string) => void;
  currentLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-rose-100 bg-pink-50/30 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition"
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name ?? item.plate}
          </option>
        ))}
        {value && currentLabel && !options.some((item) => item.id === value) && (
          <option value={value}>{currentLabel} (assigned)</option>
        )}
      </select>
    </div>
  );
}

{/* SVG Icons */}

function IconTruck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a2 2 0 104 0m-5 0a2 2 0 10-4 0" />
    </svg>
  );
}

function IconDriver({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconPackage({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconAlert({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IconSearch({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function IconCalendar({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
