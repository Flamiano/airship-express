"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import { SkeletonTable } from "../../components/PageSkeleton";
import { useParcelStore, receiveParcel, bulkDeliverParcels } from "@/app/lib/parcelStore";
import { updateParcelStatus } from "@/app/lib/api";
import { COURIER_NAMES, CourierName, Parcel, ParcelType, PARCEL_STATUS_LABEL } from "@/app/lib/parcelTypes";

const PARCEL_TYPES: ParcelType[] = [
  "Document",
  "E-commerce Package",
  "Electronics",
  "Clothing",
  "Bulk / Box",
  "Fragile",
];

const COURIER_OPTIONS: CourierName[] = Array.from(COURIER_NAMES) as CourierName[];

const COURIER_BRANDING: Record<CourierName, { label: string; badge: string; accent: string; icon: string }> = {
  "ShopeeXpress": { label: "Shopee Xpress", badge: "bg-orange-50 text-orange-700 border-orange-200", accent: "bg-orange-500 text-white", icon: "S" },
  "JNT Express": { label: "J&T Express", badge: "bg-rose-50 text-rose-700 border-rose-200", accent: "bg-rose-600 text-white", icon: "J" },
  "Lazada Express": { label: "Lazada Express", badge: "bg-indigo-50 text-indigo-700 border-indigo-200", accent: "bg-indigo-600 text-white", icon: "L" },
  "Flash Express": { label: "Flash Express", badge: "bg-amber-50 text-amber-800 border-amber-200", accent: "bg-amber-500 text-white", icon: "F" },
  "TikTok Delivery": { label: "TikTok Delivery", badge: "bg-slate-100 text-slate-800 border-slate-200", accent: "bg-slate-900 text-white", icon: "T" },
  "LBC": { label: "LBC Express", badge: "bg-red-50 text-red-700 border-red-200", accent: "bg-red-600 text-white", icon: "L" },
  "GOGO Xpress": { label: "GOGO Xpress", badge: "bg-pink-50 text-pink-700 border-pink-200", accent: "bg-pink-600 text-white", icon: "G" },
  "Airship Express": { label: "Airship Express", badge: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", accent: "bg-fuchsia-600 text-white", icon: "A" },
};

const STATUS_FILTERS = ["All", "RECEIVED", "BOOKED", "IN_TRANSIT"] as const;
const SORT_OPTIONS = ["Newest", "Weight", "Destination"] as const;
import { PERSISTED_SERVICE_AREA_KEY, ALL_SERVICE_AREA_SENTINEL, SERVICE_AREA_CITIES, SERVICE_CITY_BOUNDS, inferCityFromCoordinates } from "@/app/lib/serviceAreas";

type StatusFilter = (typeof STATUS_FILTERS)[number];
type SortOption = (typeof SORT_OPTIONS)[number];
type ServiceAreaCity = (typeof SERVICE_AREA_CITIES)[number];

// use shared inferCityFromCoordinates from serviceAreas

function formatRelative(iso: string) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function persistBulkServiceArea(value: string | null) {
  if (typeof window === "undefined") return;
  const nextValue = value && value !== "All Service Cities" ? value : ALL_SERVICE_AREA_SENTINEL;
  window.sessionStorage.setItem(PERSISTED_SERVICE_AREA_KEY, nextValue);
}

function normalizeLocationText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getLocationParts(address: string, lat?: number | null, lng?: number | null) {
  const raw = (address || "").trim().replace(/\s+/g, " ");
  const normalized = normalizeLocationText(raw);
  const segments = raw ? raw.split(",").map((segment) => segment.trim()).filter(Boolean) : [];

  let city: ServiceAreaCity | undefined = inferCityFromCoordinates(lat, lng);

  if (!city) {
    const directCityMatch = SERVICE_AREA_CITIES.find((cityName) =>
      normalized.includes(normalizeLocationText(cityName))
    );

    if (directCityMatch) {
      city = directCityMatch;
    } else {
      const citySegment = segments.find((segment) =>
        SERVICE_AREA_CITIES.some((cityName) => normalizeLocationText(segment).includes(normalizeLocationText(cityName)))
      );
      if (citySegment) {
        city = SERVICE_AREA_CITIES.find((cityName) =>
          normalizeLocationText(citySegment).includes(normalizeLocationText(cityName))
        );
      }
      if (!city && normalized.includes("metro manila")) {
        city = "Manila";
      }
    }
  }

  if (!city && raw) {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && !/^(street|st|road|rd|ave|avenue|blvd|boulevard|drive|dr|lane|ln|highway|hwy)$/i.test(lastSegment)) {
      city = SERVICE_AREA_CITIES.find((serviceCity) =>
        normalizeLocationText(lastSegment).includes(normalizeLocationText(serviceCity))
      ) ?? "Manila";
    }
  }

  const barangaySegment = segments.find((segment) => /\b(?:barangay|brgy|bgy|purok|sitio|zone|zon\s*\d+)\b/i.test(segment));
  const barangay = barangaySegment
    ? barangaySegment
        .replace(/\b(?:barangay|brgy|bgy)\b[:\s]*/gi, "")
        .replace(/\b(?:purok|sitio|zone)\b[:\s]*/gi, "")
        .trim()
    : segments[0] && segments[0] !== city
    ? segments[0]
    : undefined;

  const safeCity = city ?? "Manila";

  return {
    city: safeCity,
    barangay,
    label: barangay ? `${safeCity} • ${barangay}` : safeCity,
  };
}

export default function VrdsParcelsPage() {
  const { parcels, ready }: { parcels: Parcel[]; ready: boolean } = useParcelStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [activeParcel, setActiveParcel] = useState<Parcel | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("All");
  const [selectedCourier, setSelectedCourier] = useState<CourierName | "">("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("Newest");
  const [viewMode, setViewMode] = useState<"grid" | "stream">("grid");

  useEffect(() => {
    if (typeof window === "undefined") return;

    persistBulkServiceArea(selectedLocation || null);

    if (!selectedLocation) {
      const saved = window.sessionStorage.getItem(PERSISTED_SERVICE_AREA_KEY);
      if (saved && saved !== ALL_SERVICE_AREA_SENTINEL && SERVICE_AREA_CITIES.includes(saved as ServiceAreaCity)) {
        setSelectedLocation(saved);
      }
    }
  }, [selectedLocation]);

  const receivedParcels = useMemo<Parcel[]>(() => parcels.filter((p) => p.status === "RECEIVED"), [parcels]);
  const readyParcels = useMemo<Parcel[]>(() => parcels.filter((p) => p.status === "READY_FOR_BOOKING"), [parcels]);
  const bookedParcels = useMemo<Parcel[]>(() => parcels.filter((p) => p.status === "BOOKED"), [parcels]);

  const availableParcels = useMemo<Parcel[]>(
    () => parcels.filter((p) => p.status !== "DELIVERED" && p.status !== "CANCELLED"),
    [parcels]
  );

  const filteredParcels = useMemo<Parcel[]>(() => {
    const query = searchText.toLowerCase().trim();
    return availableParcels
      .filter((p) => {
        if (!query) return true;
        return [p.trackingNumber, p.senderName, p.recipientName, p.destinationAddress, p.parcelType]
          .some((value) => value?.toLowerCase().includes(query));
      })
      .filter((p) => {
        if (filterStatus === "All") return true;
        return p.status === filterStatus;
      })
      .filter((p) => {
        if (!selectedCourier) return true;
        return (p.courier ?? "LBC") === selectedCourier;
      })
      .filter((p) => {
        if (!selectedLocation) return true;
        const location = getLocationParts(p.destinationAddress ?? "", p.destLat, p.destLng);
        const parcelCity = SERVICE_AREA_CITIES.includes(location.city as ServiceAreaCity)
          ? location.city
          : "Unknown";
        return parcelCity === selectedLocation;
      })
      .sort((a, b) => {
        if (sortBy === "Weight") {
          return b.weightKg - a.weightKg;
        }
        if (sortBy === "Destination") {
          return a.destinationAddress.localeCompare(b.destinationAddress);
        }
        const aTime = new Date(a.receivedAt).getTime() || 0;
        const bTime = new Date(b.receivedAt).getTime() || 0;
        return bTime - aTime;
      });
  }, [availableParcels, searchText, filterStatus, selectedCourier, selectedLocation, sortBy]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filteredParcels.length > 0 && filteredParcels.every((p) => selected.has(p.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredParcels.map((p) => p.id)));
    }
  };

  const selectedParcels = availableParcels.filter((p) => selected.has(p.id));
  const bulkDeliverEligible = selectedParcels.length > 0 && selectedParcels.every((p) => p.status === "RECEIVED");

  const courierGroups = useMemo(() => {
    const groups = new Map<CourierName, Parcel[]>();
    COURIER_OPTIONS.forEach((courier) => groups.set(courier, []));
    filteredParcels.forEach((parcel) => {
      const location = getLocationParts(parcel.destinationAddress ?? "", parcel.destLat, parcel.destLng);
      const parcelCity = SERVICE_AREA_CITIES.includes(location.city as ServiceAreaCity)
        ? location.city
        : "Unknown";
      if (selectedLocation && parcelCity !== selectedLocation) return;
      const courier = (parcel.courier ?? "LBC") as CourierName;
      if (!groups.has(courier)) groups.set(courier, []);
      groups.get(courier)!.push(parcel);
    });
    return COURIER_OPTIONS.map((courier) => ({ courier, parcels: groups.get(courier) ?? [] }));
  }, [filteredParcels, selectedLocation]);

  const locationGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; parcels: Parcel[] }>();
    if (!selectedCourier) {
      SERVICE_AREA_CITIES.forEach((city) => groups.set(city, { key: city, label: city, parcels: [] }));
    }

    filteredParcels.forEach((parcel) => {
      if (selectedCourier && (parcel.courier ?? "LBC") !== selectedCourier) return;
      const location = getLocationParts(parcel.destinationAddress ?? "", parcel.destLat, parcel.destLng);
      const city = SERVICE_AREA_CITIES.includes(location.city as ServiceAreaCity)
        ? location.city
        : "Unknown";
      if (!groups.has(city)) groups.set(city, { key: city, label: city, parcels: [] });
      groups.get(city)!.parcels.push(parcel);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aIndex = SERVICE_AREA_CITIES.indexOf(a.key as ServiceAreaCity);
      const bIndex = SERVICE_AREA_CITIES.indexOf(b.key as ServiceAreaCity);
      if (aIndex === -1 && bIndex === -1) return b.parcels.length - a.parcels.length;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [filteredParcels, selectedCourier]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-inherit font-sans selection:bg-pink-500 selection:text-white">
      <GlobalNavbar />

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 border border-pink-500/30">
          <span className="flex h-2 w-2 rounded-full bg-pink-500 animate-ping" />
          <span>{toast}</span>
        </div>
      )}

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-10 py-8 max-w-[1920px] mx-auto">
        {/* Hero Section - White & Pink Soft Glassmorphism */}
        <section className="relative overflow-hidden rounded-3xl border border-pink-200/80 bg-gradient-to-br from-white via-pink-50/40 to-pink-100/30 p-6 md:p-8 shadow-sm backdrop-blur-md">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-pink-300/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-pink-400/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-3.5 py-1.5 text-xs font-semibold text-pink-700 border border-pink-200">
                <span className="material-symbols-outlined text-[16px]">local_post_office</span>
                VRDS Parcel Operations Hub
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
                Streamlined Parcel Logistics & Hub Distribution
              </h1>
              <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
                Receive, organize, and dispatch parcels seamlessly. Group by courier or coverage city to convert intake into live dispatched routes.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <FeatureBadge icon="verified" label="Validated Tracking" />
                <FeatureBadge icon="distance" label="Metro Manila Service" />
                <FeatureBadge icon="route" label="Smart Grouping" />
                <FeatureBadge icon="speed" label="Rapid Dispatch" />
              </div>
            </div>

            {/* Hub Metrics Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 w-full lg:max-w-2xl">
              <StatusCard
                label="Waiting Intake"
                value={receivedParcels.length}
                description="Arrived at hub"
                icon="inbox"
                color="pink"
              />
              <StatusCard
                label="Ready to Book"
                value={readyParcels.length}
                description="Staged for dispatch"
                icon="mark_as_unread"
                color="pink"
              />
              <StatusCard
                label="Active Bookings"
                value={bookedParcels.length}
                description="Assigned & routed"
                icon="local_shipping"
                color="pink"
              />
              <StatusCard
                label="Total Inventory"
                value={parcels.length}
                description="In VRDS pipeline"
                icon="inventory_2"
                color="pink"
              />
            </div>
          </div>
        </section>

        {/* Filter Toolbar & Actions */}
        <section className="mt-8 rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[280px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400 text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by tracking #, recipient, sender, or barangay..."
                className="w-full rounded-xl border border-pink-100 bg-pink-50/30 pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-pink-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/20"
              />
              {searchText && (
                <button
                  onClick={() => setSearchText("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Filter Dropdowns & View Switches */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-200 bg-pink-50/40 p-1.5">
                {STATUS_FILTERS.map((status) => {
                  const isActive = filterStatus === status;
                  const label = status === "All" ? "All" : status === "RECEIVED" ? "Pick Up" : status === "BOOKED" ? "Booked" : "In Transit";

                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFilterStatus(status)}
                      className={`relative rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-pink-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-white hover:text-pink-700"
                      }`}
                    >
                      <span className="relative z-10">{label}</span>
                    </button>
                  );
                })}
              </div>

              <select
                value={selectedCourier}
                onChange={(e) => setSelectedCourier(e.target.value as CourierName | "")}
                className="rounded-xl border border-pink-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 transition hover:border-pink-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 cursor-pointer"
              >
                <option value="">All Couriers</option>
                {courierGroups.map((group) => (
                  <option key={group.courier} value={group.courier}>
                    {group.courier} ({group.parcels.length})
                  </option>
                ))}
              </select>

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="rounded-xl border border-pink-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 transition hover:border-pink-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 cursor-pointer"
              >
                <option value="">All Service Cities</option>
                {locationGroups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.label} ({group.parcels.length})
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-xl border border-pink-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 transition hover:border-pink-300 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 cursor-pointer"
              >
                <option value="Newest">Sort: Newest</option>
                <option value="Weight">Sort: Weight</option>
                <option value="Destination">Sort: Destination</option>
              </select>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-xl border border-pink-200 bg-pink-50/50 p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    viewMode === "grid" ? "bg-pink-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">grid_view</span>
                </button>
                <button
                  onClick={() => setViewMode("stream")}
                  title="Horizontal Stream"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    viewMode === "stream" ? "bg-pink-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">view_carousel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Row & Bulk Selection Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-pink-100 pt-4">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAll}
                className="inline-flex items-center gap-2 rounded-xl border border-pink-200 bg-pink-50/50 px-3 py-1.5 text-xs font-semibold text-pink-700 hover:bg-pink-100 transition"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {filteredParcels.length > 0 && filteredParcels.every((p) => selected.has(p.id))
                    ? "check_box"
                    : "check_box_outline_blank"}
                </span>
                {filteredParcels.length > 0 && filteredParcels.every((p) => selected.has(p.id))
                  ? "Deselect All"
                  : "Select All Filtered"}
              </button>
              <span className="text-xs font-medium text-slate-500">
                Showing <strong className="text-slate-900">{filteredParcels.length}</strong> of {availableParcels.length} parcels
                {selected.size > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-700">
                    {selected.size} selected
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowReceiveModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-pink-700 transition active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Receive Parcel
              </button>

              <button
                onClick={() => bulkDeliverEligible && setShowBulkModal(true)}
                disabled={!bulkDeliverEligible}
                title={bulkDeliverEligible ? "Book received parcels for dispatch" : "Booking is available only for Received parcels"}
                className="inline-flex items-center gap-2 rounded-xl border border-pink-300 bg-pink-50 px-4 py-2 text-xs sm:text-sm font-semibold text-pink-700 shadow-xs hover:bg-pink-100 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                Book for Dispatch {selectedParcels.length > 0 && `(${selectedParcels.length})`}
              </button>
            </div>
          </div>
        </section>

        {/* Parcels Inventory Container */}
        <section className="mt-6">
          {!ready ? (
            <SkeletonTable rows={6} />
          ) : filteredParcels.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-pink-200/80 bg-white p-16 text-center shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 text-pink-500 mb-4">
                <span className="material-symbols-outlined text-[32px]">inventory</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">No parcels found</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md">
                No parcels matched your active search or filters. Try adjusting your courier selection or clear search query.
              </p>
              <button
                onClick={() => {
                  setSearchText("");
                  setFilterStatus("All");
                  setSelectedCourier("");
                  setSelectedLocation("");
                }}
                className="mt-5 rounded-xl border border-pink-300 bg-pink-50 px-4 py-2 text-xs font-semibold text-pink-700 hover:bg-pink-100 transition"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div key={filterStatus} className="animate-[fadeIn_180ms_ease-out] transition-all duration-200">
              {viewMode === "grid" ? (
                /* Responsive Full Width Parcel Cards Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {filteredParcels.map((parcel) => (
                    <ParcelCard
                      key={parcel.id}
                      parcel={parcel}
                      isSelected={selected.has(parcel.id)}
                      onToggle={() => toggle(parcel.id)}
                      onOpenDetail={() => setActiveParcel(parcel)}
                    />
                  ))}
                </div>
              ) : (
                /* Horizontal Continuous Stream View */
                <ParcelCarouselStream
                  parcels={filteredParcels}
                  selected={selected}
                  onToggle={toggle}
                  onOpenDetail={setActiveParcel}
                />
              )}
            </div>
          )}
        </section>
      </main>

      <GlobalFooter />

      {/* Modals */}
      {showReceiveModal && (
        <ReceiveParcelModal
          onClose={() => setShowReceiveModal(false)}
          onReceived={(trackingNumber) => {
            setShowReceiveModal(false);
            showToast(`Parcel ${trackingNumber} received and registered.`);
          }}
        />
      )}

      {activeParcel && (
        <ParcelDetailsModal
          parcel={activeParcel}
          onClose={() => setActiveParcel(null)}
        />
      )}

      {showBulkModal && (
        <BulkDeliverModal
          parcels={selectedParcels}
          selectedLocation={selectedLocation || "All Service Cities"}
          onClose={() => setShowBulkModal(false)}
          onConfirmed={(parcelCount) => {
            setShowBulkModal(false);
            setSelected(new Set());
            setSelectedLocation("");
            showToast(`${parcelCount} parcel${parcelCount === 1 ? "" : "s"} marked Booked. Continue to Route Planning.`);
          }}
        />
      )}
    </div>
  );
}

{/* Redesigned Parcel Card - Clean, White & Pink, Highly Readable */}
function ParcelCard({
  parcel,
  isSelected,
  onToggle,
  onOpenDetail,
}: {
  parcel: Parcel;
  isSelected: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
}) {
  const rawCourier = (parcel as any).courier ?? (parcel as any).courier_name ?? "LBC";
  const brand = COURIER_BRANDING[rawCourier as CourierName] ?? {
    label: String(rawCourier || "LBC"),
    badge: "bg-pink-50 text-pink-700 border-pink-200",
    accent: "bg-pink-600 text-white",
    icon: String((rawCourier || "L").toString().charAt(0)).toUpperCase(),
  };

  const loc = getLocationParts(parcel.destinationAddress ?? "", parcel.destLat, parcel.destLng);

  return (
    <div
      onClick={onOpenDetail}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
        isSelected
          ? "border-pink-500 bg-pink-50/70 shadow-md ring-2 ring-pink-500/20"
          : "border-pink-100 bg-white hover:border-pink-300 hover:shadow-md"
      }`}
    >
      <div>
        {/* Top Header Row: Checkbox, Courier Badge, Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-pink-300 text-pink-600 focus:ring-pink-500/30 cursor-pointer"
            />
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${brand.badge}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${brand.accent}`}>
                {brand.icon}
              </span>
              <span className="truncate max-w-[90px]">{brand.label}</span>
            </span>
          </div>

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight ${
              parcel.status === "RECEIVED"
                ? "bg-amber-100 text-amber-800"
                : parcel.status === "READY_FOR_BOOKING"
                ? "bg-emerald-100 text-emerald-800"
                : parcel.status === "IN_TRANSIT"
                ? "bg-sky-100 text-sky-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {parcel.status === "RECEIVED" ? "Pick Up" : PARCEL_STATUS_LABEL[parcel.status] || parcel.status}
          </span>
        </div>

        {/* Tracking Number */}
        <div className="mt-3">
          <p className="text-[10px] font-bold tracking-wider uppercase text-pink-600">Tracking Number</p>
          <p className="text-sm font-bold text-slate-900 group-hover:text-pink-600 transition-colors truncate">
            {parcel.trackingNumber}
          </p>
        </div>

        {/* Package Metadata */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-pink-50/40 p-2.5 text-xs">
          <div>
            <span className="block text-[10px] text-slate-500 font-medium">Type</span>
            <span className="font-semibold text-slate-800 truncate block">{parcel.parcelType}</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 font-medium">Weight</span>
            <span className="font-semibold text-slate-800 block">{parcel.weightKg ? `${parcel.weightKg} kg` : "—"}</span>
          </div>
        </div>

        {/* Destination & Recipient */}
        <div className="mt-3 text-xs space-y-1">
          <div className="flex items-start gap-1 text-slate-600">
            <span className="material-symbols-outlined text-[14px] text-pink-500 mt-0.5 shrink-0">location_on</span>
            <p className="line-clamp-2 text-slate-700 leading-snug font-medium">
              {parcel.destinationAddress}
            </p>
          </div>
          <div className="flex items-center gap-1 text-slate-500 text-[11px] pl-4">
            <span className="font-semibold text-slate-700">To:</span> {parcel.recipientName}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between border-t border-pink-100 pt-2.5 text-[11px] text-slate-400">
        <span>{formatRelative(parcel.receivedAt)}</span>
        <span className="text-pink-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
          Details <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        </span>
      </div>
    </div>
  );
}

// Horizontal Carousel Stream View
function ParcelCarouselStream({
  parcels,
  selected,
  onToggle,
  onOpenDetail,
}: {
  parcels: Parcel[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpenDetail: (parcel: Parcel) => void;
}) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (parcels.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= parcels.length) {
      setActiveIndex(0);
    }
  }, [parcels.length, activeIndex]);

  useEffect(() => {
    if (parcels.length === 0) return;
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % parcels.length);
    }, 3600);
    return () => window.clearInterval(intervalId);
  }, [parcels.length]);

  useEffect(() => {
    const node = itemRefs.current[activeIndex];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div className="rounded-3xl border border-pink-200 bg-white p-6 shadow-sm overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-pink-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">view_carousel</span>
          Live Parcel Queue Stream
        </h3>
        <span className="text-xs text-slate-500">Scroll horizontally or inspect individual cards</span>
      </div>

      <div
        ref={carouselRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-pink-200 scroll-smooth"
      >
        {parcels.map((parcel) => (
          <div key={parcel.id} className="min-w-[280px] max-w-[280px] snap-start">
            <ParcelCard
              parcel={parcel}
              isSelected={selected.has(parcel.id)}
              onToggle={() => onToggle(parcel.id)}
              onOpenDetail={() => onOpenDetail(parcel)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

{/* Status Badge Component */}
function StatusCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-pink-200/60 bg-white p-4 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between text-pink-600">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="material-symbols-outlined text-[20px] text-pink-500">{icon}</span>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-500 truncate">{description}</p>
      </div>
    </div>
  );
}

function FeatureBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-xl border border-pink-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
      <span className="material-symbols-outlined text-[16px] text-pink-600">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

{/* Modal: Receive Parcel */}
function ReceiveParcelModal({
  onClose,
  onReceived,
}: {
  onClose: () => void;
  onReceived: (trackingNumber: string) => void;
}) {
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [parcelType, setParcelType] = useState<ParcelType>("Document");
  const [weightKg, setWeightKg] = useState("1.0");
  const [courier, setCourier] = useState<CourierName>("LBC");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [destLatInput, setDestLatInput] = useState("");
  const [destLngInput, setDestLngInput] = useState("");

  const submit = async () => {
    if (!senderName || !recipientName || !destinationAddress || !weightKg) {
      setError("Sender, recipient, destination, and weight are required.");
      return;
    }
    const weight = parseFloat(weightKg);
    if (Number.isNaN(weight) || weight <= 0) {
      setError("Enter a valid weight in kg.");
      return;
    }

    let lat = parseFloat(destLatInput);
    let lng = parseFloat(destLngInput);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      try {
        const q = encodeURIComponent(destinationAddress + ", Metro Manila");
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          lat = parseFloat(data[0].lat);
          lng = parseFloat(data[0].lon);
        } else {
          lat = 14.5995;
          lng = 120.9745;
        }
      } catch (e) {
        lat = 14.5995;
        lng = 120.9745;
      }
    }

    const parcel = receiveParcel({
      senderName,
      senderPhone,
      recipientName,
      recipientPhone,
      destinationAddress,
      destLat: Number.isFinite(lat) ? lat : 14.5995,
      destLng: Number.isFinite(lng) ? lng : 120.9745,
      parcelType,
      weightKg: weight,
      courier,
      notes,
    });

    onReceived(parcel.trackingNumber);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl border border-pink-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-pink-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
              <span className="material-symbols-outlined text-[20px]">add_box</span>
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Receive New Parcel Intake</h3>
              <p className="text-xs text-slate-500">Register incoming shipment into VRDS Hub inventory</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        <div className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Sender Name *</label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="E.g. Juan Dela Cruz"
              className="w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2 text-sm text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Sender Contact</label>
            <input
              type="text"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              placeholder="+63 917 000 0000"
              className="w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2 text-sm text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Recipient Name *</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="E.g. Maria Santos"
              className="w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2 text-sm text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Recipient Contact</label>
            <input
              type="text"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="+63 918 000 0000"
              className="w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2 text-sm text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Destination Address *</label>
            <input
              type="text"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="Street, Barangay, City, Metro Manila"
              className="w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2 text-sm text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Courier Carrier</label>
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value as CourierName)}
              className="w-full rounded-xl border border-pink-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-pink-500 focus:outline-none"
            >
              {COURIER_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Parcel Category</label>
            <select
              value={parcelType}
              onChange={(e) => setParcelType(e.target.value as ParcelType)}
              className="w-full rounded-xl border border-pink-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-pink-500 focus:outline-none"
            >
              {PARCEL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Weight (kg) *</label>
            <input
              type="number"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2 text-sm text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Notes / Instructions</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Fragile, handle with care"
              className="w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2 text-sm text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-pink-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-xl bg-pink-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-pink-700 transition"
          >
            Confirm & Save Parcel
          </button>
        </div>
      </div>
    </div>
  );
}

{/* Modal: Parcel Details */}
function ParcelDetailsModal({
  parcel,
  onClose,
}: {
  parcel: Parcel;
  onClose: () => void;
}) {
  const brand = COURIER_BRANDING[(parcel.courier ?? "LBC") as CourierName] ?? {
    label: parcel.courier || "LBC",
    badge: "bg-pink-50 text-pink-700 border-pink-200",
    accent: "bg-pink-600 text-white",
    icon: "L",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-pink-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-pink-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${brand.badge}`}>
                {brand.label}
              </span>
              <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-bold text-pink-700">
                {parcel.status === "RECEIVED" ? "Pick Up" : PARCEL_STATUS_LABEL[parcel.status] || parcel.status}
              </span>
            </div>
            <h3 className="mt-2 text-xl font-black text-slate-900">{parcel.trackingNumber}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-pink-50/50 p-3.5 border border-pink-100">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500">Sender</p>
              <p className="font-semibold text-slate-900">{parcel.senderName || "—"}</p>
              <p className="text-slate-500">{parcel.senderPhone}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500">Recipient</p>
              <p className="font-semibold text-slate-900">{parcel.recipientName || "—"}</p>
              <p className="text-slate-500">{parcel.recipientPhone}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-pink-100 p-3.5 space-y-2">
            <div>
              <p className="text-[10px] font-bold uppercase text-pink-600">Destination Address</p>
              <p className="font-medium text-slate-800 mt-0.5">{parcel.destinationAddress}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-pink-50">
              <div>
                <p className="text-[10px] text-slate-500">Parcel Type</p>
                <p className="font-semibold text-slate-800">{parcel.parcelType}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Weight</p>
                <p className="font-semibold text-slate-800">{parcel.weightKg} kg</p>
              </div>
            </div>
          </div>

          {parcel.notes && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-800">
              <span className="font-bold">Notes:</span> {parcel.notes}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-pink-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-pink-700 transition"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

{/* Modal: Bulk Deliver */}
function BulkDeliverModal({
  parcels,
  selectedLocation,
  onClose,
  onConfirmed,
}: {
  parcels: Parcel[];
  selectedLocation: string;
  onClose: () => void;
  onConfirmed: (parcelCount: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleBulkConfirm = async () => {
    setError(null);
    setSaving(true);
    try {
      persistBulkServiceArea(selectedLocation === "All Service Cities" ? null : selectedLocation);
      // The parcels database uses `picked_up` for this booked/staged state.
      // The client normalizes it to the workflow's BOOKED status.
      await Promise.all(parcels.map((parcel) => updateParcelStatus(parcel.id, "picked_up")));
      bulkDeliverParcels(parcels.map((parcel) => parcel.id));
      onConfirmed(parcels.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create bulk booking.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-pink-200 bg-white p-6 shadow-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 mb-4">
          <span className="material-symbols-outlined text-[30px]">local_shipping</span>
        </div>

        <h3 className="text-xl font-bold text-slate-900">Bulk Book Selected Parcels</h3>
        <p className="mt-2 text-xs text-slate-600">
          You are about to mark <strong className="text-pink-600">{parcels.length} selected parcels</strong> as Booked. They will then be ready for route planning.
        </p>

        <div className="mt-4 max-h-40 overflow-y-auto rounded-2xl border border-pink-100 bg-pink-50/40 p-3 text-left text-xs space-y-1">
          {parcels.map((p) => (
            <div key={p.id} className="flex justify-between font-medium text-slate-700">
              <span className="truncate max-w-[180px]">{p.trackingNumber}</span>
              <span className="text-pink-600">{p.courier || "LBC"}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={handleBulkConfirm}
            className="rounded-xl bg-pink-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-pink-700 transition"
          >
            {saving ? "Booking..." : "Mark as Booked"}
          </button>
        </div>
        {error && <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
