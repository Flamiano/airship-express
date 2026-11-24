"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  Copy,
  Eye,
  Fuel,
  GripVertical,
  Layers,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Route as RouteIcon,
  Save,
  Search,
  Sparkles,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { fetchJson } from "../../../lib/api";
import { isWithinMetroManila, METRO_MANILA_BOUNDS } from "../../../lib/metroManilaGeo";
import { canCollectParcelOnRoute } from "../../../lib/routeParcelEligibility";
import type { LeafletMarker } from "../../../components/map/LeafletMap";
import { SkeletonMap } from "../../../components/global/PageSkeleton";

const LeafletMap = dynamic(() => import("../../../components/map/LeafletMap"), {
  ssr: false,
  loading: () => <SkeletonMap className="h-full min-h-[380px] w-full" />,
});

type LatLng = { lat: number; lng: number };
type TransportPurpose = "company_supply" | "business_parcel";
type RouteType =
  | "Hub-to-Hub"
  | "Warehouse-to-Warehouse"
  | "Warehouse-to-House"
  | "House-to-House"
  | "Hub-to-House"
  | "Custom Route";
type LocationKind = "hub" | "warehouse" | "customer" | "pickup" | "delivery" | "custom";
type ParcelEvent = {
  parcelId: string;
  trackingNumber: string;
  kind: "pickup" | "delivery";
  weightKg?: number;
};
type RoutePoint = {
  locationId: string;
  kind: LocationKind;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  parcelEvents?: ParcelEvent[];
};
type RouteStop = RoutePoint & {
  id: string;
  purpose: string;
  arrival: string;
  departure: string;
  durationMinutes: number;
  instructions: string;
  parcelReference: string;
  weightKg?: number | null;
};
type LocationOption = {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean | null;
};
type ParcelRecord = {
  id: string;
  [key: string]: unknown;
  status?: string | null;
  tracking_number?: string | null;
  trackingNumber?: string | null;
  pickup_address?: string | null;
  pickupAddress?: string | null;
  pickup_location?: string | null;
  pickupLocation?: string | null;
  sender_address?: string | null;
  senderAddress?: string | null;
  dropoff_location?: string | null;
  dropoffLocation?: string | null;
  delivery_address?: string | null;
  deliveryAddress?: string | null;
  destination?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  courier?: string | null;
  weight_kg?: number | null;
  parcel_type?: string | null;
  parcelType?: string | null;
  notes?: string | null;
  route_plan_id?: string | null;
  routePlanId?: string | null;
};
type FleetVehicle = {
  id: string;
  plate_number?: string;
  vehicle_type?: string;
  name?: string;
  courier?: string | null;
  courierId?: string | null;
  capacityKg?: number;
  capacity_kg?: number;
  status?: string;
  fuelEfficiencyKmPerL?: number | null;
};
type Optimization = {
  engine?: string | null;
  fallback?: boolean;
  fallbackReason?: string | null;
  optimizedAt?: string | null;
  distanceKm?: number | null;
  osrmDistanceKm?: number | null;
  durationMinutes?: number | null;
  osrmDurationMinutes?: number | null;
  [key: string]: unknown;
};
type RoutePlanDetails = {
  transport_purpose?: string | null;
  purpose?: string | null;
  route_type?: string | null;
  routeType?: string | null;
  display_status?: string | null;
  origin?: RoutePoint;
  destination?: RoutePoint;
  stops?: RouteStop[];
  vehicle_type?: string | null;
  supply_manifest?: unknown;
  supply_category?: unknown;
  supply_units?: unknown;
  priority?: unknown;
  cargo_weight_kg?: unknown;
  notes?: unknown;
  optimization?: Optimization | null;
  [key: string]: unknown;
};
type RoutePlan = {
  id?: string | number | null;
  name?: string | null;
  route_name?: string | null;
  status?: string | null;
  route_details?: RoutePlanDetails | null;
  routeDetails?: RoutePlanDetails | null;
  transport_purpose?: string | null;
  purpose?: string | null;
  route_type?: string | null;
  route_geojson?: { route_geometry?: { coordinates?: unknown } | null } | null;
  routeGeojson?: { route_geometry?: { coordinates?: unknown } | null } | null;
  delivery_destinations?: unknown[] | null;
  parcel_ids?: unknown[] | null;
  vehicle_type?: string | null;
  scheduled_at?: unknown;
  expected_arrival?: unknown;
  notes?: string | null;
  [key: string]: unknown;
};
type SearchResult = {
  display_name?: string;
  name?: string;
  lat?: string | number;
  lon?: string | number;
  properties?: { name?: string; lat?: number; lon?: number };
  geometry?: { coordinates?: number[] };
};

type RouteForm = {
  id: string | null;
  name: string;
  purpose: TransportPurpose;
  routeType: RouteType;
  vehicleType: string;
  parcelIds: string[];
  supplyManifest: string;
  supplyCategory: string;
  supplyUnits: string;
  origin: RoutePoint;
  destination: RoutePoint;
  stops: RouteStop[];
  scheduledAt: string;
  expectedArrival: string;
  priority: string;
  loadKg: string;
  notes: string;
  status: string;
  optimization: Optimization | null;
  polyline: LatLng[];
};

type TripWorkspaceItem = {
  tripId: string;
  label: string;
  form: RouteForm;
  selectedStopId: string | null;
  roadError: string;
  formError: string;
  lastSavedAt: string | null;
};

const ROUTE_TYPES: Array<{ value: RouteType; origin: LocationKind; destination: LocationKind }> = [
  { value: "Hub-to-Hub", origin: "hub", destination: "hub" },
  { value: "Warehouse-to-Warehouse", origin: "warehouse", destination: "warehouse" },
  { value: "Warehouse-to-House", origin: "warehouse", destination: "customer" },
  { value: "House-to-House", origin: "customer", destination: "customer" },
  { value: "Hub-to-House", origin: "hub", destination: "customer" },
  { value: "Custom Route", origin: "custom", destination: "custom" },
];

const VEHICLE_TYPE_PRESETS: Array<{
  value: string;
  label: string;
  defaultCapacityKg: number;
  defaultEfficiencyKmPerL: number;
  summary: string;
}> = [
  {
    value: "Motorcycle",
    label: "Motorcycle",
    defaultCapacityKg: 25,
    defaultEfficiencyKmPerL: 42,
    summary: "Agile small-parcel & light supply runs in dense NCR streets",
  },
  {
    value: "Van",
    label: "Delivery Van",
    defaultCapacityKg: 800,
    defaultEfficiencyKmPerL: 11,
    summary: "Multi-stop business parcels & medium warehouse transfers",
  },
  {
    value: "Light Truck",
    label: "Light Truck",
    defaultCapacityKg: 2500,
    defaultEfficiencyKmPerL: 7.5,
    summary: "Consolidated company supplies & high-volume shipments",
  },
  {
    value: "Heavy Truck",
    label: "Heavy Truck",
    defaultCapacityKg: 8000,
    defaultEfficiencyKmPerL: 4.5,
    summary: "Bulk warehouse equipment, pallets & heavy facility transfers",
  },
];

const HUB_POINT: RoutePoint = {
  locationId: "airship-binondo",
  kind: "hub",
  name: "Airship Express Hub - Binondo, Manila",
  address: "Binondo, Manila, Metro Manila, Philippines",
  lat: 14.5995,
  lng: 120.9745,
};

const PLAN_STATUSES = [
  "Draft",
  "Scheduled",
  "Active",
  "In Progress",
  "Completed",
  "Cancelled",
] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  planned: "border-sky-200 bg-sky-50 text-sky-700",
  scheduled: "border-sky-200 bg-sky-50 text-sky-700",
  assigned: "border-pink-200 bg-pink-50 text-pink-700",
  vehicle_assigned: "border-pink-200 bg-pink-50 text-pink-700",
  driver_assigned: "border-pink-200 bg-pink-50 text-pink-700",
  ready: "border-pink-200 bg-pink-50 text-pink-700",
  active: "border-amber-200 bg-amber-50 text-amber-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed_with_remaining: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  booked: "border-blue-200 bg-blue-50 text-blue-700",
  picked_up: "border-amber-200 bg-amber-50 text-amber-800",
  in_transit: "border-sky-200 bg-sky-50 text-sky-800",
  delayed: "border-rose-200 bg-rose-50 text-rose-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  collected: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const DEFAULT_HUBS: LocationOption[] = [
  {
    id: HUB_POINT.locationId,
    name: HUB_POINT.name,
    address: HUB_POINT.address,
    latitude: HUB_POINT.lat,
    longitude: HUB_POINT.lng,
  },
];

function dateInputValue(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function pointFromLocation(location: LocationOption, kind: LocationKind): RoutePoint {
  return {
    locationId: location.id,
    kind,
    name: location.name,
    address: location.address,
    lat: location.latitude == null ? null : Number(location.latitude),
    lng: location.longitude == null ? null : Number(location.longitude),
  };
}

function blankPoint(kind: LocationKind = "custom"): RoutePoint {
  return { locationId: "", kind, name: "", address: "", lat: null, lng: null };
}

function haversineKm(start: LatLng, end: LatLng) {
  const radiusKm = 6371;
  const dLat = ((end.lat - start.lat) * Math.PI) / 180;
  const dLng = ((end.lng - start.lng) * Math.PI) / 180;
  const lat1 = (start.lat * Math.PI) / 180;
  const lat2 = (end.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createStop(
  kind: LocationKind = "delivery",
  purpose: TransportPurpose = "business_parcel"
): RouteStop {
  const defaultPurpose =
    purpose === "company_supply"
      ? kind === "pickup" || kind === "warehouse"
        ? "Supply dispatch / pickup"
        : "Facility / branch delivery"
      : kind === "pickup"
        ? "Parcel pickup"
        : "Delivery";
  return {
    ...blankPoint(kind),
    id: `stop-${crypto.randomUUID()}`,
    purpose: defaultPurpose,
    arrival: "",
    departure: "",
    durationMinutes: 10,
    instructions: "",
    parcelReference: "",
    weightKg: null,
  };
}

function statusLabel(raw: unknown) {
  const status = String(raw || "draft").toLowerCase();
  if (status === "planned") return "Scheduled";
  if (["vehicle_assigned", "driver_assigned", "ready", "assigned"].includes(status)) {
    return "Scheduled";
  }
  if (status === "active") return "Active";
  if (status === "in_progress") return "In Progress";
  if (status === "completed_with_remaining") return "Completed";
  return status.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusCode(raw: string) {
  if (raw === "Scheduled") return "planned";
  if (raw === "Active" || raw === "In Progress") return "in_progress";
  if (raw === "Completed") return "completed";
  if (raw === "Cancelled") return "cancelled";
  return "draft";
}

function routePoints(form: RouteForm): RoutePoint[] {
  return [form.origin, ...form.stops, form.destination];
}

function validPoint(point: RoutePoint) {
  return Boolean(
    point.name.trim() &&
      point.address.trim() &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      Math.abs(Number(point.lat)) <= 90 &&
      Math.abs(Number(point.lng)) <= 180 &&
      !(Number(point.lat) === 0 && Number(point.lng) === 0)
  );
}

function cargoLoadForRoute(form: RouteForm, parcelById: Map<string, ParcelRecord>) {
  const manualLoad = Number(form.loadKg);
  if (Number.isFinite(manualLoad) && manualLoad > 0) {
    return { loadKg: manualLoad, complete: true };
  }

  const weights = form.purpose === "company_supply"
    ? form.stops.map((stop) => Number(stop.weightKg))
    : form.parcelIds.map((id) => Number(parcelById.get(id)?.weight_kg));
  const validWeights = weights.filter((weight) => Number.isFinite(weight) && weight > 0);
  return {
    loadKg: validWeights.reduce((total, weight) => total + weight, 0),
    complete: validWeights.length === weights.length,
  };
}

function preservesParcelEventOrder(
  origin: RoutePoint,
  stops: RouteStop[],
  destination: RoutePoint,
  parcelIds: string[]
) {
  const sequence = [origin, ...stops, destination];
  return parcelIds.every((parcelId) => {
    const pickupIndex = sequence.findIndex((point) =>
      point.parcelEvents?.some((event) => event.parcelId === parcelId && event.kind === "pickup")
    );
    const deliveryIndex = sequence.findIndex((point) =>
      point.parcelEvents?.some((event) => event.parcelId === parcelId && event.kind === "delivery")
    );
    return pickupIndex < 0 || deliveryIndex < 0 || pickupIndex < deliveryIndex;
  });
}

function parcelLocation(parcel: ParcelRecord, kind: ParcelEvent["kind"]): RoutePoint | null {
  const row = parcel as Record<string, unknown>;
  const firstValue = (...keys: string[]) =>
    keys.map((key) => row[key]).find((value) => value != null && String(value).trim()) as
      | string
      | number
      | undefined;
  const isPickup = kind === "pickup";
  const address = firstValue(
    ...(isPickup
      ? [
          "pickup_address",
          "pickupAddress",
          "pickup_location",
          "pickupLocation",
          "sender_address",
          "senderAddress",
          "origin_address",
          "originAddress",
        ]
      : [
          "dropoff_location",
          "dropoffLocation",
          "delivery_address",
          "deliveryAddress",
          "destination",
          "destination_address",
          "destinationAddress",
          "address",
        ])
  );
  if (!address) return null;
  const latitude = Number(
    firstValue(
      ...(isPickup
        ? [
            "pickup_lat",
            "pickup_latitude",
            "pickupLat",
            "pickupLatitude",
            "origin_lat",
            "originLatitude",
          ]
        : [
            "dest_lat",
            "destLat",
            "dropoff_latitude",
            "dropoffLatitude",
            "delivery_lat",
            "deliveryLatitude",
            "latitude",
            "lat",
          ])
    )
  );
  const longitude = Number(
    firstValue(
      ...(isPickup
        ? [
            "pickup_lng",
            "pickup_longitude",
            "pickupLng",
            "pickupLongitude",
            "origin_lng",
            "originLongitude",
          ]
        : [
            "dest_lng",
            "destLng",
            "dropoff_longitude",
            "dropoffLongitude",
            "delivery_lng",
            "deliveryLongitude",
            "longitude",
            "lng",
          ])
    )
  );
  const name = firstValue(
    ...(isPickup
      ? ["pickup_name", "pickupName", "sender_name", "senderName"]
      : ["recipient_name", "recipientName", "dropoff_name", "dropoffName"])
  );
  return {
    locationId: `parcel:${parcel.id}:${kind}`,
    kind: isPickup ? "pickup" : "delivery",
    name: String(
      name || String(address).split(",")[0] || (isPickup ? "Parcel pickup" : "Parcel delivery")
    ),
    address: String(address),
    lat: Number.isFinite(latitude) ? latitude : null,
    lng: Number.isFinite(longitude) ? longitude : null,
  };
}

function planDetails(plan: RoutePlan) {
  return plan.route_details || plan.routeDetails || {};
}

function inferPurposeFromPlan(plan: RoutePlan): TransportPurpose {
  const details = planDetails(plan);
  const explicit = String(
    details.transport_purpose || details.purpose || plan.transport_purpose || plan.purpose || ""
  ).toLowerCase();
  if (explicit.includes("supply") || explicit.includes("company")) return "company_supply";
  if (explicit.includes("parcel") || explicit.includes("business")) return "business_parcel";
  const rType = String(details.route_type || details.routeType || plan.route_type || "");
  if (rType === "Warehouse-to-Warehouse") return "company_supply";
  return "business_parcel";
}

function toLatLng(point: RoutePoint): LatLng | null {
  return validPoint(point) ? { lat: Number(point.lat), lng: Number(point.lng) } : null;
}

function formatKm(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)} km` : "—";
}

function formatDuration(value: unknown) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "—";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${Math.round(minutes % 60)}m` : `${Math.round(minutes)} min`;
}

function formatDate(value: unknown) {
  if (!value) return "Unscheduled";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "Unscheduled"
    : date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function mapRouteStatusToUi(plan: RoutePlan) {
  const detailStatus = planDetails(plan).display_status;
  return String(detailStatus || statusLabel(plan.status));
}

function newForm(purpose: TransportPurpose = "business_parcel"): RouteForm {
  return {
    id: null,
    name: "",
    purpose,
    routeType: purpose === "company_supply" ? "Warehouse-to-Warehouse" : "Hub-to-Hub",
    vehicleType: purpose === "company_supply" ? "Light Truck" : "Van",
    parcelIds: [],
    supplyManifest: "",
    supplyCategory: "Operational Supplies",
    supplyUnits: "",
    origin: { ...HUB_POINT },
    destination: blankPoint(purpose === "company_supply" ? "warehouse" : "hub"),
    stops: [],
    scheduledAt: dateInputValue(),
    expectedArrival: "",
    priority: "normal",
    loadKg: "",
    notes: "",
    status: "draft",
    optimization: null,
    polyline: [],
  };
}

function createTripWorkspaceItem(
  index: number,
  purpose: TransportPurpose = "business_parcel"
): TripWorkspaceItem {
  return {
    tripId: `trip-${crypto.randomUUID()}`,
    label: `Trip ${index}`,
    form: newForm(purpose),
    selectedStopId: null,
    roadError: "",
    formError: "",
    lastSavedAt: null,
  };
}

function cloneFormForTrip(source: RouteForm): RouteForm {
  return {
    ...source,
    id: null,
    name: source.name ? `${source.name} (Copy)` : "",
    parcelIds: [...source.parcelIds],
    origin: {
      ...source.origin,
      parcelEvents: source.origin.parcelEvents ? [...source.origin.parcelEvents] : undefined,
    },
    destination: {
      ...source.destination,
      parcelEvents: source.destination.parcelEvents ? [...source.destination.parcelEvents] : undefined,
    },
    stops: source.stops.map((stop) => ({
      ...stop,
      id: `stop-${crypto.randomUUID()}`,
      parcelEvents: stop.parcelEvents ? [...stop.parcelEvents] : undefined,
    })),
    optimization: source.optimization ? { ...source.optimization } : null,
    polyline: source.polyline.map((pt) => ({ ...pt })),
  };
}

function AddressFields({
  title,
  point,
  locations,
  searchResults,
  searchBusy,
  targetId,
  placingTarget,
  onChange,
  onChooseLocation,
  onSearch,
  onChooseResult,
  onPlace,
}: {
  title: string;
  point: RoutePoint;
  locations: LocationOption[];
  searchResults: SearchResult[];
  searchBusy: boolean;
  targetId: string;
  placingTarget: string | null;
  onChange: (next: RoutePoint) => void;
  onChooseLocation: (location: LocationOption) => void;
  onSearch: () => void;
  onChooseResult: (result: SearchResult) => void;
  onPlace: () => void;
}) {
  const input =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100";
  const searchRef = useRef(onSearch);
  useEffect(() => {
    searchRef.current = onSearch;
  }, [onSearch]);
  useEffect(() => {
    const query = point.address.trim();
    if (point.locationId || query.length < 3) return;
    const timeout = window.setTimeout(() => searchRef.current(), 320);
    return () => window.clearTimeout(timeout);
  }, [point.address, point.locationId, targetId]);

  const hasCoords =
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    !(Number(point.lat) === 0 && Number(point.lng) === 0);
  const insideNcr = hasCoords ? isWithinMetroManila(point.lat, point.lng) : true;

  return (
    <div className="space-y-2 rounded-lg border border-slate-100 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h4 className="text-xs font-bold text-slate-800">{title}</h4>
          {hasCoords && !insideNcr && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              <AlertTriangle size={10} /> Outside Metro Manila
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onPlace}
          aria-pressed={placingTarget === targetId}
          className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
            placingTarget === targetId
              ? "bg-pink-700 text-white"
              : "border border-pink-200 bg-white text-pink-700 hover:bg-pink-50"
          }`}
        >
          {placingTarget === targetId ? "Click map to place" : "Place on map"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
        <label className="text-[10px] font-semibold text-slate-500">
          Location type
          <select
            value={point.kind}
            onChange={(event) =>
              onChange({ ...point, kind: event.target.value as LocationKind, locationId: "" })
            }
            className={`${input} mt-1`}
          >
            <option value="hub">Parcel hub</option>
            <option value="warehouse">Warehouse / facility</option>
            <option value="customer">Customer / branch</option>
            <option value="pickup">Pickup point</option>
            <option value="delivery">Delivery point</option>
            <option value="custom">Custom location</option>
          </select>
        </label>

        {(point.kind === "hub" || point.kind === "warehouse") && (
          <label className="text-[10px] font-semibold text-slate-500">
            Saved FTM location
            <select
              value={point.locationId.startsWith("geocode:") ? "" : point.locationId}
              onChange={(event) => {
                const found = locations.find((location) => location.id === event.target.value);
                if (found) onChooseLocation(found);
                else onChange({ ...point, locationId: "" });
              }}
              className={`${input} mt-1`}
            >
              <option value="">Search or enter manually</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} · {location.address}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="block text-[10px] font-semibold text-slate-500">
        Address search (Metro Manila)
        <input
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={searchResults.length > 0}
          value={point.address}
          onChange={(event) =>
            onChange({
              ...point,
              address: event.target.value,
              locationId: "",
              lat: null,
              lng: null,
            })
          }
          className={`${input} mt-1`}
          placeholder="Street, barangay, or city in Metro Manila (e.g., BGC, Makati, Caloocan)"
        />
      </label>

      {searchBusy && (
        <p role="status" className="text-[10px] text-slate-400">
          Finding nearby Metro Manila addresses…
        </p>
      )}
      {searchResults.length > 0 && (
        <div
          role="listbox"
          aria-label={`${title} address suggestions`}
          className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-pink-100 bg-white p-1 shadow-sm"
        >
          {searchResults.map((result, index) => (
            <button
              key={`${result.lat}-${result.lon}-${index}`}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => onChooseResult(result)}
              className="block w-full rounded px-2 py-2 text-left text-[10px] leading-relaxed text-slate-600 hover:bg-pink-50 focus:bg-pink-50 focus:outline-none"
            >
              {result.display_name ||
                result.name ||
                result.properties?.name ||
                "Address suggestion"}
            </button>
          ))}
        </div>
      )}
      {!searchBusy &&
        point.address.trim().length >= 3 &&
        searchResults.length === 0 &&
        !validPoint(point) && (
          <p className="text-[10px] text-slate-400">
            No matching address yet. Refine the search or select a point on the map.
          </p>
        )}
      {hasCoords && !insideNcr && (
        <p className="text-[10px] font-medium text-rose-600">
          Selected coordinates ({Number(point.lat).toFixed(4)}, {Number(point.lng).toFixed(4)}) fall
          outside Metro Manila boundaries and will be blocked on route generation/saving.
        </p>
      )}

      <label className="block text-[10px] font-semibold text-slate-500">
        Place name
        <input
          value={point.name}
          onChange={(event) =>
            onChange({
              ...point,
              name: event.target.value,
              locationId: point.locationId.startsWith("geocode:") ? point.locationId : "",
            })
          }
          className={`${input} mt-1`}
          placeholder="Hub, warehouse, branch, or customer"
        />
      </label>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/ /g, "_");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        STATUS_STYLES[key] || STATUS_STYLES.draft
      }`}
    >
      {status}
    </span>
  );
}

function PurposeBadge({ purpose }: { purpose: TransportPurpose }) {
  return purpose === "company_supply" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
      <Building2 size={10} /> Company Supply
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-2 py-0.5 text-[10px] font-semibold text-pink-700">
      <Package size={10} /> Business Parcel
    </span>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-modal-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-pink-100 bg-white p-5 shadow-2xl sm:rounded-2xl"
      >
        <header className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 id="route-modal-title" className="text-base font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function RoutePlanningWorkspace() {
  const [plans, setPlans] = useState<RoutePlan[]>([]);
  const [allVehicles, setAllVehicles] = useState<FleetVehicle[]>([]);
  const [allParcels, setAllParcels] = useState<ParcelRecord[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>(DEFAULT_HUBS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [parcelLoadError, setParcelLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"workspace" | "management">("workspace");

  const initialTrip = useMemo(() => createTripWorkspaceItem(1, "business_parcel"), []);
  const [trips, setTrips] = useState<TripWorkspaceItem[]>([initialTrip]);
  const [activeTripId, setActiveTripId] = useState<string>(initialTrip.tripId);
  const [mapScope, setMapScope] = useState<"active" | "all">("active");
  const [optimizingAll, setOptimizingAll] = useState(false);

  const activeTrip = useMemo(
    () => trips.find((t) => t.tripId === activeTripId) || trips[0] || initialTrip,
    [trips, activeTripId, initialTrip]
  );

  const form = activeTrip.form;
  const roadError = activeTrip.roadError;
  const formError = activeTrip.formError;
  const selectedStopId = activeTrip.selectedStopId;

  const updateActiveTrip = useCallback(
    (updater: (prev: TripWorkspaceItem) => TripWorkspaceItem) => {
      setTrips((prevTrips) =>
        prevTrips.map((t) => (t.tripId === activeTrip.tripId ? updater(t) : t))
      );
    },
    [activeTrip.tripId]
  );

  const setForm = useCallback(
    (next: RouteForm | ((prev: RouteForm) => RouteForm)) => {
      updateActiveTrip((prev) => {
        const nextForm = typeof next === "function" ? next(prev.form) : next;
        const routePointCount = routePoints(nextForm).filter(validPoint).length;
        return {
          ...prev,
          form: routePointCount < 2 && nextForm.polyline.length
            ? { ...nextForm, polyline: [] }
            : nextForm,
          roadError: routePointCount < 2 ? "" : prev.roadError,
        };
      });
    },
    [updateActiveTrip]
  );

  const setRoadError = useCallback(
    (msg: string) => updateActiveTrip((prev) => ({ ...prev, roadError: msg })),
    [updateActiveTrip]
  );

  const setFormError = useCallback(
    (msg: string) => updateActiveTrip((prev) => ({ ...prev, formError: msg })),
    [updateActiveTrip]
  );

  const setSelectedStopId = useCallback(
    (id: string | null) => updateActiveTrip((prev) => ({ ...prev, selectedStopId: id })),
    [updateActiveTrip]
  );

  const [searchResults, setSearchResults] = useState<Record<string, SearchResult[]>>({});
  const [searchBusy, setSearchBusy] = useState<string | null>(null);
  const [routingRoads, setRoutingRoads] = useState(false);
  const searchSequence = useRef<Record<string, number>>({});
  const [placingTarget, setPlacingTarget] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inspectPlan, setInspectPlan] = useState<RoutePlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoutePlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);

  const [savedRouteQuery, setSavedRouteQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [routeTypeFilter, setRouteTypeFilter] = useState("all");
  const [purposeFilter, setPurposeFilter] = useState<"all" | TransportPurpose>("all");

  const [parcelQuery, setParcelQuery] = useState("");
  const [parcelStatusFilter, setParcelStatusFilter] = useState("all");

  const loadData = useCallback(async () => {
    try {
      const [planRows, vehicleRows, locationRows, parcelRows] = await Promise.all([
        fetchJson("/api/route-plans?includeClosed=true", { cache: "no-store" }),
        fetchJson("/api/vehicles", { cache: "no-store" }).catch(() => []),
        fetchJson("/api/route-locations", { cache: "no-store" }).catch(() => []),
        fetchJson("/api/parcels?history=true", { cache: "no-store" }).catch((error) => ({
          error:
            error instanceof Error ? error.message : "Unable to load Parcel Management data.",
        })),
      ]);
      setPlans(Array.isArray(planRows) ? planRows : []);
      setAllVehicles(Array.isArray(vehicleRows) ? vehicleRows : []);
      setLocations(Array.isArray(locationRows) && locationRows.length ? locationRows : DEFAULT_HUBS);
      setAllParcels(Array.isArray(parcelRows) ? parcelRows : []);
      setParcelLoadError(
        Array.isArray(parcelRows)
          ? ""
          : String(parcelRows?.error || "Unable to load Parcel Management data.")
      );
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load route planning data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The effect starts asynchronous data loading; state updates follow the network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  function resetRouteCreationState() {
    Object.keys(searchSequence.current).forEach((target) => {
      searchSequence.current[target] += 1;
    });
    const fresh = createTripWorkspaceItem(1, form.purpose);
    setTrips([fresh]);
    setActiveTripId(fresh.tripId);
    setSavedRouteQuery("");
    setStatusFilter("all");
    setRouteTypeFilter("all");
    setPurposeFilter("all");
    setSearchResults({});
    setSearchBusy(null);
    setPlacingTarget(null);
    setRoutingRoads(false);
    setOptimizing(false);
    setParcelQuery("");
    setParcelStatusFilter("all");
    setNotice("Workspace reset to a fresh unsaved trip preview.");
  }

  function handleAddTrip() {
    const nextIdx = trips.length + 1;
    const item = createTripWorkspaceItem(nextIdx, form.purpose);
    setTrips((prev) => [...prev, item]);
    setActiveTripId(item.tripId);
    setNotice(`${item.label} added to multi-trip planner.`);
  }

  function handleDuplicateTrip() {
    const nextIdx = trips.length + 1;
    const item: TripWorkspaceItem = {
      tripId: `trip-${crypto.randomUUID()}`,
      label: `Trip ${nextIdx}`,
      form: cloneFormForTrip(form),
      selectedStopId: null,
      roadError: "",
      formError: "",
      lastSavedAt: null,
    };
    setTrips((prev) => [...prev, item]);
    setActiveTripId(item.tripId);
    setNotice(`Duplicated ${activeTrip.label} into ${item.label}.`);
  }

  function handleRemoveTrip(tripId: string) {
    if (trips.length <= 1) return;
    const remaining = trips.filter((t) => t.tripId !== tripId);
    setTrips(remaining);
    if (activeTripId === tripId) {
      setActiveTripId(remaining[0].tripId);
    }
  }

  function handlePurposeChange(nextPurpose: TransportPurpose) {
    setForm((prev) => {
      const nextRouteType: RouteType =
        nextPurpose === "company_supply"
          ? prev.routeType === "Hub-to-House" || prev.routeType === "House-to-House"
            ? "Warehouse-to-Warehouse"
            : prev.routeType
          : prev.routeType;
      const nextVehicleType =
        nextPurpose === "company_supply" && prev.vehicleType === "Motorcycle"
          ? "Light Truck"
          : prev.vehicleType;
      return {
        ...prev,
        purpose: nextPurpose,
        routeType: nextRouteType,
        vehicleType: nextVehicleType,
        parcelIds: nextPurpose === "company_supply" ? [] : prev.parcelIds,
        optimization: null,
      };
    });
    setFormError("");
  }

  const vehicleTypeSpecs = useMemo(() => {
    const map = new Map<
      string,
      {
        type: string;
        label: string;
        registeredCount: number;
        maxCapacityKg: number | null;
        avgEfficiencyKmPerL: number | null;
        summary: string;
      }
    >();

    for (const preset of VEHICLE_TYPE_PRESETS) {
      map.set(preset.value.toLowerCase(), {
        type: preset.value,
        label: preset.label,
        registeredCount: 0,
        maxCapacityKg: preset.defaultCapacityKg,
        avgEfficiencyKmPerL: preset.defaultEfficiencyKmPerL,
        summary: preset.summary,
      });
    }

    for (const v of allVehicles) {
      const rawType = String(v.vehicle_type || v.name || "").trim();
      if (!rawType) continue;
      const key = rawType.toLowerCase();
      const cap = Number(v.capacityKg ?? v.capacity_kg);
      const eff = Number(v.fuelEfficiencyKmPerL);
      const existing = map.get(key);
      if (existing) {
        existing.registeredCount += 1;
        if (Number.isFinite(cap) && cap > 0) {
          existing.maxCapacityKg =
            existing.maxCapacityKg == null ? cap : Math.max(existing.maxCapacityKg, cap);
        }
        if (Number.isFinite(eff) && eff > 0) {
          existing.avgEfficiencyKmPerL =
            existing.avgEfficiencyKmPerL == null
              ? eff
              : Number(((existing.avgEfficiencyKmPerL + eff) / 2).toFixed(1));
        }
      } else {
        map.set(key, {
          type: rawType,
          label: rawType,
          registeredCount: 1,
          maxCapacityKg: Number.isFinite(cap) && cap > 0 ? cap : null,
          avgEfficiencyKmPerL: Number.isFinite(eff) && eff > 0 ? eff : null,
          summary: "Registered FTM vehicle specification",
        });
      }
    }

    return Array.from(map.values());
  }, [allVehicles]);

  const activeVehicleSpec = useMemo(() => {
    const found = vehicleTypeSpecs.find(
      (s) => s.type.toLowerCase() === form.vehicleType.toLowerCase()
    );
    return (
      found || {
        type: form.vehicleType || "Van",
        label: form.vehicleType || "Delivery Van",
        registeredCount: 0,
        maxCapacityKg: null,
        avgEfficiencyKmPerL: null,
        summary: "Selected vehicle type",
      }
    );
  }, [vehicleTypeSpecs, form.vehicleType]);

  const parcelById = useMemo(() => {
    const m = new Map<string, ParcelRecord>();
    for (const p of allParcels) m.set(String(p.id), p);
    return m;
  }, [allParcels]);

  const cargoLoad = useMemo(
    () => cargoLoadForRoute(form, parcelById),
    [form, parcelById]
  );
  const calculatedCargoKg = cargoLoad.loadKg;

  const capacityCheck = useMemo(() => {
    const cap = activeVehicleSpec.maxCapacityKg;
    const error = !cargoLoad.complete
      ? "Enter the total cargo weight or provide a valid weight for every selected parcel or supply stop."
      : cap && cap > 0 && calculatedCargoKg > cap
        ? `Total load (${calculatedCargoKg} kg) exceeds ${activeVehicleSpec.label} capacity (${cap} kg).`
        : "";
    return {
      valid: !error,
      error,
      ratio: cap && cap > 0 ? Math.round((calculatedCargoKg / cap) * 100) : null,
      cap: cap && cap > 0 ? cap : null,
      loadKg: calculatedCargoKg,
    };
  }, [activeVehicleSpec.label, activeVehicleSpec.maxCapacityKg, cargoLoad.complete, calculatedCargoKg]);

  const boundaryIssues = useMemo(() => {
    const issues: string[] = [];
    const locations = [
      { label: "Origin", point: form.origin },
      ...form.stops.map((stop, index) => ({ label: `Stop #${index + 1}`, point: stop })),
      { label: "Destination", point: form.destination },
    ];
    locations.forEach(({ label, point }) => {
      if (!validPoint(point)) {
        issues.push(`${label} must have a name, address, and valid coordinates.`);
      } else if (!isWithinMetroManila(point.lat, point.lng)) {
        issues.push(`${label} (${point.name || point.address}) is outside Metro Manila.`);
      }
    });
    return issues;
  }, [form.origin, form.stops, form.destination]);

  const handleSearchAddress = useCallback(async (targetKey: string, queryText: string) => {
    const trimmed = queryText.trim();
    if (trimmed.length < 3) return;
    const seq = (searchSequence.current[targetKey] || 0) + 1;
    searchSequence.current[targetKey] = seq;
    setSearchBusy(targetKey);
    try {
      const params = new URLSearchParams({
        q: `${trimmed}, Metro Manila, Philippines`,
        format: "json",
        addressdetails: "1",
        limit: "6",
        countrycodes: "ph",
        viewbox: `${METRO_MANILA_BOUNDS.minLng},${METRO_MANILA_BOUNDS.maxLat},${METRO_MANILA_BOUNDS.maxLng},${METRO_MANILA_BOUNDS.minLat}`,
        bounded: "1",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) return;
      const data = (await response.json()) as SearchResult[];
      if (searchSequence.current[targetKey] === seq) {
        setSearchResults((prev) => ({
          ...prev,
          [targetKey]: Array.isArray(data) ? data : [],
        }));
      }
    } catch {
      // Transient geocoding failure
    } finally {
      if (searchSequence.current[targetKey] === seq) {
        setSearchBusy(null);
      }
    }
  }, []);

  useEffect(() => {
    const routeLocations = routePoints(form);
    if (
      routeLocations.length < 2 ||
      routeLocations.some(
        (point) => !validPoint(point) || !isWithinMetroManila(point.lat, point.lng)
      )
    ) return;
    const pts = routeLocations
      .map(toLatLng)
      .filter((pt): pt is LatLng => pt !== null);
    if (pts.length < 2) return;

    let cancelled = false;
    const runOsrm = async () => {
      setRoutingRoads(true);
      setRoadError("");
      try {
        const coords = pts.map((p) => `${p.lng},${p.lat}`).join(";");
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM routing returned ${res.status}`);
        const json = await res.json();
        const routeObj = json?.routes?.[0];
        const rawCoords = routeObj?.geometry?.coordinates;
        if (cancelled) return;
        if (Array.isArray(rawCoords) && rawCoords.length > 0) {
          const line: LatLng[] = rawCoords
            .filter(
              (c: unknown): c is [number, number] =>
                Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number"
            )
            .map(([lng, lat]) => ({ lat, lng }));
          const distKm =
            typeof routeObj.distance === "number"
              ? Number((routeObj.distance / 1000).toFixed(2))
              : undefined;
          const durMin =
            typeof routeObj.duration === "number"
              ? Math.round(routeObj.duration / 60)
              : undefined;
          setForm((prev) => ({
            ...prev,
            polyline: line,
            optimization: {
              ...(prev.optimization || {}),
              distanceKm:
                prev.optimization?.distanceKm != null ? prev.optimization.distanceKm : distKm,
              durationMinutes:
                prev.optimization?.durationMinutes != null
                  ? prev.optimization.durationMinutes
                  : durMin,
              osrmDistanceKm: distKm,
              osrmDurationMinutes: durMin,
            },
          }));
        } else {
          setForm((prev) => ({ ...prev, polyline: pts }));
        }
      } catch (err) {
        if (!cancelled) {
          setRoadError(
            err instanceof Error
              ? `OSRM road geometry unavailable: ${err.message}`
              : "OSRM road geometry unavailable."
          );
          setForm((prev) => ({ ...prev, polyline: pts }));
        }
      } finally {
        if (!cancelled) setRoutingRoads(false);
      }
    };

    const timer = window.setTimeout(() => void runOsrm(), 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    form.origin.lat,
    form.origin.lng,
    form.destination.lat,
    form.destination.lng,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(form.stops.map((s) => [s.lat, s.lng])),
    setForm,
    setRoadError,
  ]);

  async function optimizeTripForm(targetForm: RouteForm): Promise<{
    nextForm: RouteForm;
    message: string;
    isError: boolean;
  }> {
    const targetVehicleSpec = vehicleTypeSpecs.find(
      (spec) => spec.type.toLowerCase() === targetForm.vehicleType.toLowerCase()
    ) ?? {
      ...activeVehicleSpec,
      type: targetForm.vehicleType || "Van",
      label: targetForm.vehicleType || "Delivery Van",
      maxCapacityKg: null,
      avgEfficiencyKmPerL: null,
      summary: "Selected vehicle type",
    };
    const locations = routePoints(targetForm);
    const invalidLocation = locations.find((point) => !validPoint(point));
    if (invalidLocation) {
      return {
        nextForm: targetForm,
        message: "Origin, destination, and every stop need valid coordinates before optimizing.",
        isError: true,
      };
    }

    const outsideLocation = locations.find(
      (point) => !isWithinMetroManila(point.lat, point.lng)
    );
    if (outsideLocation) {
      return {
        nextForm: targetForm,
        message:
          `${outsideLocation.name || outsideLocation.address} is outside Metro Manila geographic boundaries.`,
        isError: true,
      };
    }

    const cap = targetVehicleSpec.maxCapacityKg;
    const cargoLoad = cargoLoadForRoute(targetForm, parcelById);
    const loadKg = cargoLoad.loadKg;

    if (!cargoLoad.complete) {
      return {
        nextForm: targetForm,
        message: "Enter the total cargo weight or provide a valid weight for every selected parcel or supply stop.",
        isError: true,
      };
    }

    if (cap && cap > 0 && loadKg > cap) {
      return {
        nextForm: targetForm,
        message: `Cargo load (${loadKg} kg) exceeds ${targetVehicleSpec.label} capacity (${cap} kg). Choose a higher-capacity vehicle type or reduce cargo.`,
        isError: true,
      };
    }

    try {
      const payload = {
        origin: {
          lat: Number(targetForm.origin.lat),
          lng: Number(targetForm.origin.lng),
        },
        destination: {
          lat: Number(targetForm.destination.lat),
          lng: Number(targetForm.destination.lng),
        },
        stops: targetForm.stops.map((stop) => ({
          id: stop.id,
          lat: Number(stop.lat),
          lng: Number(stop.lng),
          ...(Number.isFinite(Number(stop.weightKg)) && Number(stop.weightKg) >= 0
            ? { weightKg: Number(stop.weightKg) }
            : {}),
          ...(stop.parcelEvents?.length
            ? {
                parcelEvents: stop.parcelEvents.map((event) => ({
                  parcelId: event.parcelId,
                  kind: event.kind,
                  ...(event.weightKg != null ? { weightKg: event.weightKg } : {}),
                })),
              }
            : {}),
        })),
        vehicleCount: 1,
        cargoWeightKg: loadKg,
        vehicleCapacityKg: cap ?? undefined,
        fuelEfficiencyKmPerL: targetVehicleSpec.avgEfficiencyKmPerL ?? undefined,
      };

      const result = await fetchJson("/api/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!Array.isArray(result?.orderedStopIds)) {
        throw new Error("The optimizer response is missing its ordered stop IDs.");
      }
      const stopsById = new Map(targetForm.stops.map((stop) => [stop.id, stop]));
      const optimizedStops: RouteStop[] = result.orderedStopIds.map((id: unknown) => {
        if (typeof id !== "string") {
          throw new Error("The optimizer returned an invalid stop ID.");
        }
        const stop = stopsById.get(id);
        if (!stop) throw new Error("The optimizer returned a stop that is not in this route.");
        return stop;
      });
      if (
        optimizedStops.length !== targetForm.stops.length ||
        new Set(result.orderedStopIds).size !== targetForm.stops.length
      ) {
        throw new Error("The optimizer did not return every route stop exactly once.");
      }
      const precedenceOk = preservesParcelEventOrder(
        targetForm.origin,
        optimizedStops,
        targetForm.destination,
        targetForm.parcelIds
      );

      if (!precedenceOk) {
        return {
          nextForm: targetForm,
          message:
            "Optimizer returned a sequence that violates parcel pickup-before-delivery order. Kept existing sequence.",
          isError: true,
        };
      }

      const engineName = String(result?.engine || result?.optimizer || "OR-Tools");
      const fallbackUsed = result?.engine !== "or-tools"
        || Boolean(result?.fallback || result?.fallbackUsed);
      const fallbackReason = result?.fallbackReason || result?.reason || "";
      const optimizedDistanceKm = Number(result?.distanceMi) * 1.609344;
      const optimizedDurationMinutes = Number(result?.etaMinutes);
      const optimizedPolyline: LatLng[] = Array.isArray(result?.polyline)
        ? result.polyline.flatMap((point: unknown) => {
            if (!point || typeof point !== "object" || Array.isArray(point)) return [];
            const coordinates = point as Record<string, unknown>;
            const lat = Number(coordinates.lat);
            const lng = Number(coordinates.lng);
            return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
          })
        : [];
      if (
        !Number.isFinite(optimizedDistanceKm) ||
        !Number.isFinite(optimizedDurationMinutes) ||
        optimizedPolyline.length < 2
      ) {
        throw new Error("The optimizer returned incomplete route geometry or metrics.");
      }

      const nextOpt: Optimization = {
        ...(targetForm.optimization || {}),
        ...result,
        engine: engineName,
        fallback: fallbackUsed,
        fallbackReason,
        distanceKm: optimizedDistanceKm,
        durationMinutes: optimizedDurationMinutes,
        distanceSavedKm: Number(result?.distanceSavedMi) * 1.609344,
        baselineDistanceKm: Number(result?.baselineDistanceMi) * 1.609344,
        optimizedAt: new Date().toISOString(),
      };

      return {
        nextForm: {
          ...targetForm,
          stops: optimizedStops,
          polyline: optimizedPolyline,
          optimization: nextOpt,
        },
        message: fallbackUsed
          ? `Optimized with fallback (${engineName})${fallbackReason ? `: ${fallbackReason}` : ""}.`
          : `Route optimized using ${engineName}.`,
        isError: false,
      };
    } catch (error) {
      const unvisited = [...targetForm.stops];
      const ordered: RouteStop[] = [];
      let currentLatLng: LatLng = {
        lat: Number(targetForm.origin.lat),
        lng: Number(targetForm.origin.lng),
      };

      while (unvisited.length > 0) {
        const eligibleIndices = unvisited
          .map((stop, idx) => ({ stop, idx }))
          .filter(({ stop }) => {
            const deliveriesHere =
              stop.parcelEvents?.filter((e) => e.kind === "delivery") || [];
            if (!deliveriesHere.length) return true;
            return deliveriesHere.every((del) =>
              [targetForm.origin, ...ordered].some((pt) =>
                pt.parcelEvents?.some(
                  (ev) => ev.parcelId === del.parcelId && ev.kind === "pickup"
                )
              )
            );
          });

        const pool =
          eligibleIndices.length > 0
            ? eligibleIndices
            : unvisited.map((stop, idx) => ({ stop, idx }));
        let best = pool[0];
        let bestDist = Number.POSITIVE_INFINITY;
        for (const candidate of pool) {
          const ll = toLatLng(candidate.stop);
          if (!ll) continue;
          const d = haversineKm(currentLatLng, ll);
          if (d < bestDist) {
            bestDist = d;
            best = candidate;
          }
        }
        ordered.push(best.stop);
        const nextLl = toLatLng(best.stop);
        if (nextLl) currentLatLng = nextLl;
        unvisited.splice(best.idx, 1);
      }

      const fallbackOpt: Optimization = {
        ...(targetForm.optimization || {}),
        engine: "Local Heuristic Fallback (OR-Tools Unavailable)",
        fallback: true,
        fallbackReason:
          error instanceof Error ? error.message : "Optimization service unreachable",
        optimizedAt: new Date().toISOString(),
      };

      return {
        nextForm: {
          ...targetForm,
          stops: ordered,
          optimization: fallbackOpt,
        },
        message: `OR-Tools optimizer unavailable (${fallbackOpt.fallbackReason}). Applied local sequence fallback—verify before saving.`,
        isError: true,
      };
    }
  }

  async function handleOptimizeActiveTrip() {
    setOptimizing(true);
    setFormError("");
    try {
      const { nextForm, message, isError } = await optimizeTripForm(form);
      setForm(nextForm);
      if (isError) setFormError(message);
      else setNotice(`${activeTrip.label}: ${message}`);
    } finally {
      setOptimizing(false);
    }
  }

  async function handleOptimizeAllTrips() {
    setOptimizingAll(true);
    try {
      const updated = await Promise.all(
        trips.map(async (trip) => {
          const { nextForm, message, isError } = await optimizeTripForm(trip.form);
          return {
            ...trip,
            form: nextForm,
            formError: isError ? message : "",
          };
        })
      );
      setTrips(updated);
      setNotice(`Completed optimization pass across ${updated.length} trip(s).`);
    } finally {
      setOptimizingAll(false);
    }
  }

  async function handleSaveRoutePlan(event?: FormEvent) {
    if (event) event.preventDefault();
    setFormError("");

    if (!validPoint(form.origin) || !validPoint(form.destination)) {
      setFormError("Please provide valid origin and destination locations.");
      return;
    }

    if (boundaryIssues.length > 0) {
      setFormError(boundaryIssues.join(" "));
      return;
    }

    if (
      !preservesParcelEventOrder(form.origin, form.stops, form.destination, form.parcelIds)
    ) {
      setFormError(
        "Parcel pickup stops must appear before their corresponding delivery stops."
      );
      return;
    }

    if (!capacityCheck.valid) {
      setFormError(capacityCheck.error);
      return;
    }

    setSaving(true);
    try {
      const generatedName =
        form.name.trim() ||
        `${
          form.purpose === "company_supply" ? "Supply" : "Parcel"
        } Route · ${form.origin.name.split(",")[0]} → ${
          form.destination.name.split(",")[0]
        }`;

      const payload: Record<string, unknown> = {
        name: generatedName,
        route_type: form.routeType,
        vehicle_type: form.vehicleType,
        status: statusCode(form.status),
        scheduled_at: form.scheduledAt || null,
        expected_arrival: form.expectedArrival || null,
        parcel_ids: form.parcelIds,
        route_details: {
          transport_purpose: form.purpose,
          route_type: form.routeType,
          vehicle_type: form.vehicleType,
          vehicle_capacity_kg: capacityCheck.cap,
          cargo_weight_kg: capacityCheck.loadKg,
          supply_manifest: form.supplyManifest,
          supply_category: form.supplyCategory,
          supply_units: form.supplyUnits,
          origin: form.origin,
          destination: form.destination,
          stops: form.stops,
          included_parcel_ids: form.parcelIds,
          priority: form.priority,
          notes: form.notes,
          optimization: form.optimization,
        },
        route_geojson:
          form.polyline.length > 0
            ? {
                route_geometry: {
                  type: "LineString",
                  coordinates: form.polyline.map((p) => [p.lng, p.lat]),
                },
              }
            : null,
      };

      const saved = form.id
        ? await fetchJson(`/api/route-plans/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetchJson("/api/route-plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const savedId = String(saved?.id || form.id || "");
      setForm((prev) => ({ ...prev, id: savedId || prev.id, name: generatedName }));
      updateActiveTrip((prev) => ({ ...prev, lastSavedAt: new Date().toISOString() }));
      setNotice(
        form.id
          ? `Updated saved route plan "${generatedName}".`
          : `Saved new route plan "${generatedName}".`
      );
      await loadData();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save route plan."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDeletePlan() {
    if (!deleteTarget) return;
    setDeletingPlan(true);
    try {
      await fetchJson(`/api/route-plans/${deleteTarget.id}`, { method: "DELETE" });
      if (form.id === String(deleteTarget.id)) {
        setForm((prev) => ({ ...prev, id: null }));
      }
      setNotice(`Deleted route plan "${deleteTarget.name || deleteTarget.id}".`);
      setDeleteTarget(null);
      if (inspectPlan?.id === deleteTarget.id) setInspectPlan(null);
      await loadData();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to delete route plan."
      );
    } finally {
      setDeletingPlan(false);
    }
  }

  function handleLoadPlanIntoTrip(plan: RoutePlan) {
    const details = planDetails(plan);
    const purpose = inferPurposeFromPlan(plan);
    const origin: RoutePoint = details.origin?.address ? details.origin : { ...HUB_POINT };
    const destination: RoutePoint = details.destination?.address
      ? details.destination
      : blankPoint(purpose === "company_supply" ? "warehouse" : "hub");
    const stops: RouteStop[] = Array.isArray(details.stops) ? details.stops : [];
    const rawCoords =
      plan.route_geojson?.route_geometry?.coordinates ??
      plan.routeGeojson?.route_geometry?.coordinates;
    const polyline: LatLng[] = Array.isArray(rawCoords)
      ? rawCoords
          .filter(
            (c: unknown): c is [number, number] =>
              Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number"
          )
          .map(([lng, lat]) => ({ lat, lng }))
      : [];

    const nextForm: RouteForm = {
      id: String(plan.id || ""),
      name: String(plan.name || plan.route_name || ""),
      purpose,
      routeType: (details.route_type ||
        plan.route_type ||
        (purpose === "company_supply" ? "Warehouse-to-Warehouse" : "Hub-to-Hub")) as RouteType,
      vehicleType: String(
        details.vehicle_type ||
          plan.vehicle_type ||
          (purpose === "company_supply" ? "Light Truck" : "Van")
      ),
      parcelIds: Array.isArray(details.included_parcel_ids)
        ? details.included_parcel_ids.map(String)
        : Array.isArray(plan.parcel_ids)
          ? plan.parcel_ids.map(String)
          : [],
      supplyManifest: String(details.supply_manifest || ""),
      supplyCategory: String(details.supply_category || "Operational Supplies"),
      supplyUnits: String(details.supply_units || ""),
      origin,
      destination,
      stops,
      scheduledAt: plan.scheduled_at
        ? dateInputValue(new Date(String(plan.scheduled_at)))
        : dateInputValue(),
      expectedArrival: plan.expected_arrival
        ? dateInputValue(new Date(String(plan.expected_arrival)))
        : "",
      priority: String(details.priority || "normal"),
      loadKg: details.cargo_weight_kg != null ? String(details.cargo_weight_kg) : "",
      notes: String(details.notes || plan.notes || ""),
      status: mapRouteStatusToUi(plan),
      optimization: details.optimization || null,
      polyline,
    };

    setForm(nextForm);
    setSelectedStopId(null);
    setInspectPlan(null);
    setActiveTab("workspace");
    setNotice(`Loaded "${nextForm.name || "Saved Route"}" into ${activeTrip.label}.`);
  }

  const mapMarkers: LeafletMarker[] = useMemo(() => {
    const markers: LeafletMarker[] = [];
    const targetTrips = mapScope === "all" ? trips : [activeTrip];

    targetTrips.forEach((trip) => {
      const f = trip.form;
      const prefix = trips.length > 1 ? `[${trip.label}] ` : "";
      const oLl = toLatLng(f.origin);
      if (oLl) {
        markers.push({
          id: `${trip.tripId}-origin`,
          position: oLl,
          label: `${prefix}Origin: ${f.origin.name || f.origin.address}`,
          color: trip.tripId === activeTrip.tripId ? "#be185d" : "#64748b",
        });
      }

      f.stops.forEach((stop, sIdx) => {
        const sLl = toLatLng(stop);
        if (!sLl) return;
        const isPickup =
          stop.kind === "pickup" ||
          stop.parcelEvents?.some((e) => e.kind === "pickup");
        markers.push({
          id: `${trip.tripId}::${stop.id}`,
          position: sLl,
          label: `${prefix}Stop ${sIdx + 1}: ${stop.name || stop.address} (${stop.purpose})`,
          color:
            trip.tripId === activeTrip.tripId
              ? isPickup
                ? "#d97706"
                : "#0284c7"
              : "#94a3b8",
        });
      });

      const dLl = toLatLng(f.destination);
      if (dLl) {
        markers.push({
          id: `${trip.tripId}-destination`,
          position: dLl,
          label: `${prefix}Destination: ${f.destination.name || f.destination.address}`,
          color: trip.tripId === activeTrip.tripId ? "#059669" : "#475569",
        });
      }
    });

    return markers;
  }, [mapScope, trips, activeTrip]);

  const activePolyline = useMemo(() => {
    if (form.polyline.length >= 2) return form.polyline;
    return routePoints(form)
      .map(toLatLng)
      .filter((pt): pt is LatLng => pt !== null);
  }, [form]);

  const activeRouteFocusPoints = useMemo(() => {
    const waypoints = routePoints(form)
      .map(toLatLng)
      .filter((point): point is LatLng => point !== null);
    return waypoints.length >= 2 ? [...activePolyline, ...waypoints] : [];
  }, [activePolyline, form]);

  const mapRoutePaths = useMemo(() => {
    if (mapScope !== "all") return [];
    const colors = ["#0284c7", "#059669", "#d97706", "#7c3aed", "#0f766e"];
    return trips.flatMap((trip, index) => {
      const points = trip.form.polyline.length >= 2
        ? trip.form.polyline
        : routePoints(trip.form)
            .map(toLatLng)
            .filter((point): point is LatLng => point !== null);
      return points.length >= 2
        ? [{
            points,
            color: trip.tripId === activeTrip.tripId ? "#be185d" : colors[index % colors.length],
            label: trip.label,
          }]
        : [];
    });
  }, [mapScope, trips, activeTrip.tripId]);

  const allRouteFocusPoints = useMemo(() => {
    if (mapScope !== "all") return [];
    return trips.flatMap((trip) => {
      const waypoints = routePoints(trip.form)
        .map(toLatLng)
        .filter((point): point is LatLng => point !== null);
      if (waypoints.length < 2) return [];
      return [
        ...(trip.form.polyline.length >= 2 ? trip.form.polyline : waypoints),
        ...waypoints,
      ];
    });
  }, [mapScope, trips]);

  const selectedStop = useMemo(
    () => form.stops.find((s) => s.id === selectedStopId) || null,
    [form.stops, selectedStopId]
  );

  const selectedStopPoint = selectedStop ? toLatLng(selectedStop) : null;
  const mapFocusPoints = selectedStopPoint
    ? [selectedStopPoint]
    : mapScope === "all" ? allRouteFocusPoints : activeRouteFocusPoints;
  const tripFocusSignature = (trip: TripWorkspaceItem) => {
    const waypoints = routePoints(trip.form)
      .map((point) => `${point.locationId}:${point.lat},${point.lng}`)
      .join(";");
    const roadPath = trip.form.polyline
      .map((point) => `${point.lat},${point.lng}`)
      .join(";");
    return `${trip.tripId}:${trip.form.id || "draft"}:${waypoints}:${roadPath}:${trip.form.optimization?.optimizedAt || ""}`;
  };
  const mapFocusKey = mapScope === "all"
    ? `all:${trips.map(tripFocusSignature).join("|")}:${activeTrip.tripId}:${selectedStopId || ""}`
    : `active:${tripFocusSignature(activeTrip)}:${selectedStopId || ""}`;

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const uiStatus = mapRouteStatusToUi(plan);
      if (statusFilter !== "all" && uiStatus.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      const pPurpose = inferPurposeFromPlan(plan);
      if (purposeFilter !== "all" && pPurpose !== purposeFilter) return false;
      const pType = String(plan.route_type || planDetails(plan).route_type || "");
      if (routeTypeFilter !== "all" && pType !== routeTypeFilter) return false;
      const q = savedRouteQuery.trim().toLowerCase();
      if (q) {
        const details = planDetails(plan);
        const hay = `${plan.name || ""} ${plan.route_name || ""} ${pType} ${
          details.origin?.name || details.origin?.address || ""
        } ${details.destination?.name || details.destination?.address || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [plans, statusFilter, purposeFilter, routeTypeFilter, savedRouteQuery]);

  const filteredParcels = useMemo(() => {
    return allParcels.filter((p) => {
      if (parcelStatusFilter !== "all") {
        const st = String(p.status || "").toLowerCase();
        if (st !== parcelStatusFilter.toLowerCase()) return false;
      }
      const q = parcelQuery.trim().toLowerCase();
      if (q) {
        const hay = `${p.tracking_number || p.trackingNumber || p.id} ${
          p.pickup_address || p.pickup_location || ""
        } ${p.dropoff_location || p.delivery_address || p.destination || ""} ${
          p.courier || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allParcels, parcelStatusFilter, parcelQuery]);

  const totalRoadKm = form.optimization?.distanceKm ?? form.optimization?.osrmDistanceKm ?? null;
  const totalDurationMin =
    form.optimization?.durationMinutes ?? form.optimization?.osrmDurationMinutes ?? null;
  const estimatedFuelLiters =
    totalRoadKm != null &&
    activeVehicleSpec.avgEfficiencyKmPerL &&
    activeVehicleSpec.avgEfficiencyKmPerL > 0
      ? Number(totalRoadKm) / activeVehicleSpec.avgEfficiencyKmPerL
      : null;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600 text-white shadow-sm">
              <RouteIcon size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                  FTM Route Planning &amp; Optimization
                </h1>
                <PurposeBadge purpose={form.purpose} />
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  Metro Manila NCR Only
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Multi-trip planning for Company Supply &amp; Business Parcel operations. Driver &amp; vehicle unit assignment remain in the Assignment page.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("workspace")}
                className={`rounded-md px-3 py-1.5 transition ${
                  activeTab === "workspace"
                    ? "bg-white text-pink-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Route Builder ({trips.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("management")}
                className={`rounded-md px-3 py-1.5 transition ${
                  activeTab === "management"
                    ? "bg-white text-pink-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Saved Plans ({plans.length})
              </button>
            </div>

            <button
              type="button"
              onClick={handleOptimizeActiveTrip}
              disabled={optimizing || optimizingAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700 transition hover:bg-pink-100 disabled:opacity-50"
            >
              <Sparkles size={14} />
              {optimizing ? "Optimizing…" : `Optimize ${activeTrip.label}`}
            </button>

            {trips.length > 1 && (
              <button
                type="button"
                onClick={handleOptimizeAllTrips}
                disabled={optimizing || optimizingAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Layers size={14} />
                {optimizingAll ? "Optimizing All…" : "Optimize All Trips"}
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleSaveRoutePlan()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-pink-700 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "Saving…" : form.id ? "Update Plan" : "Save Route Plan"}
            </button>

            <button
              type="button"
              onClick={resetRouteCreationState}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              title="Reset workspace"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        </div>

        {activeTab === "workspace" && (
          <div className="border-t border-slate-100 bg-slate-50/90 px-4 py-2 sm:px-6">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {trips.map((trip) => {
                  const isCurrent = trip.tripId === activeTrip.tripId;
                  return (
                    <div
                      key={trip.tripId}
                      className={`inline-flex items-center rounded-lg border text-xs font-semibold transition ${
                        isCurrent
                          ? "border-pink-300 bg-white text-pink-700 shadow-2xs"
                          : "border-slate-200 bg-white/70 text-slate-600 hover:bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTripId(trip.tripId);
                          setTrips((current) => current.map((item) => item.tripId === trip.tripId
                            ? { ...item, selectedStopId: null }
                            : item));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5"
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            trip.form.purpose === "company_supply"
                              ? "bg-indigo-500"
                              : "bg-pink-500"
                          }`}
                        />
                        <span>{trip.label}</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          · {trip.form.stops.length} stop{trip.form.stops.length === 1 ? "" : "s"}
                        </span>
                      </button>
                      {trips.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTrip(trip.tripId)}
                          aria-label={`Remove ${trip.label}`}
                          className="pr-2 pl-1 text-slate-400 hover:text-rose-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleAddTrip}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-pink-300 bg-pink-50/60 px-2.5 py-1.5 text-xs font-semibold text-pink-700 hover:bg-pink-50"
                >
                  <Plus size={13} /> Add Trip
                </button>
                <button
                  type="button"
                  onClick={handleDuplicateTrip}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Copy size={12} /> Duplicate Trip
                </button>
              </div>

              {trips.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] font-medium text-slate-500">Map view:</span>
                  <button
                    type="button"
                    onClick={() => setMapScope("active")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      mapScope === "active"
                        ? "bg-slate-800 text-white"
                        : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {activeTrip.label} Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapScope("all")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      mapScope === "all"
                        ? "bg-slate-800 text-white"
                        : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    All {trips.length} Trips
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-[1600px] space-y-2 px-4 pt-3 sm:px-6">
        {loadError && (
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
            <span className="flex items-center gap-2 font-medium">
              <AlertTriangle size={15} /> {loadError}
            </span>
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-md bg-rose-700 px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              Retry
            </button>
          </div>
        )}
        {parcelLoadError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Parcel list warning: {parcelLoadError}
          </div>
        )}
        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={15} className="text-emerald-600" /> {notice}
            </span>
            <button
              type="button"
              onClick={() => setNotice("")}
              className="text-emerald-700 hover:text-emerald-900"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {formError && (
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
            <span className="flex items-center gap-2 font-medium">
              <AlertTriangle size={15} /> {formError}
            </span>
            <button
              type="button"
              onClick={() => setFormError("")}
              className="text-rose-700 hover:text-rose-900"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {roadError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            {roadError}
          </div>
        )}
      </div>

      {loading ? (
        <div className="mx-auto max-w-[1600px] p-6">
          <SkeletonMap className="h-[480px] w-full rounded-2xl" />
        </div>
      ) : activeTab === "workspace" ? (
        <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 p-4 sm:p-6 lg:grid-cols-12">
          <section className="space-y-4 lg:col-span-5">
            {/* 1. Transportation Purpose */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Transportation Purpose
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {form.id ? `Editing Saved #${form.id}` : "Unsaved Route Preview"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handlePurposeChange("business_parcel")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    form.purpose === "business_parcel"
                      ? "border-pink-400 bg-pink-50/70 ring-2 ring-pink-100"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Package size={14} className="text-pink-600" />
                    Business Parcel
                  </span>
                  <span className="mt-1 text-[11px] leading-snug text-slate-500">
                    Pickups, deliveries &amp; multi-stop business shipments
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePurposeChange("company_supply")}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    form.purpose === "company_supply"
                      ? "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-100"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Building2 size={14} className="text-indigo-600" />
                    Company Supply
                  </span>
                  <span className="mt-1 text-[11px] leading-snug text-slate-500">
                    Internal supplies, equipment &amp; facility transfers
                  </span>
                </button>
              </div>

              {form.purpose === "company_supply" ? (
                <div className="mt-3 space-y-2.5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Supply Category
                      <select
                        value={form.supplyCategory}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, supplyCategory: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                      >
                        <option value="Operational Supplies">Operational Supplies</option>
                        <option value="Warehouse Equipment">Warehouse Equipment</option>
                        <option value="Packaging & Materials">Packaging &amp; Materials</option>
                        <option value="Branch Replenishment">Branch Replenishment</option>
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">
                      Cargo Weight (kg)
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={form.loadKg}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, loadKg: e.target.value }))
                        }
                        placeholder="e.g., 350"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </label>
                  </div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Supply Manifest / Requisition Reference
                    <input
                      value={form.supplyManifest}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, supplyManifest: e.target.value }))
                      }
                      placeholder="e.g., SUP-NCR-2026-042 · Racks, scanners, crates"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-pink-100 bg-pink-50/40 p-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">
                      Selected Parcels: {form.parcelIds.length}
                    </span>
                    <span className="text-slate-500">
                      Parcel weight:{" "}
                      {form.parcelIds
                        .reduce((sum, id) => sum + (Number(parcelById.get(id)?.weight_kg) || 0), 0)
                        .toFixed(1)}{" "}
                      kg
                    </span>
                  </div>
                  {form.parcelIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {form.parcelIds.map((pid) => {
                        const p = parcelById.get(pid);
                        const code = p?.tracking_number || p?.trackingNumber || pid;
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1 rounded-md border border-pink-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            {String(code)}
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  parcelIds: prev.parcelIds.filter((x) => x !== pid),
                                  stops: prev.stops.filter(
                                    (s) => !s.parcelEvents?.some((ev) => ev.parcelId === pid)
                                  ),
                                }))
                              }
                              className="text-slate-400 hover:text-rose-600"
                              aria-label={`Remove parcel ${String(code)}`}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Route & Vehicle-Type Optimization */}
            <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Route &amp; Vehicle-Type Optimization
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Truck size={12} /> {activeVehicleSpec.label}
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-slate-600">
                  Route Plan Name
                  <input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Caloocan - Makati Morning Loop"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </label>

                <label className="text-[11px] font-semibold text-slate-600">
                  Route Pattern
                  <select
                    value={form.routeType}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, routeType: e.target.value as RouteType }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    {ROUTE_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>
                        {rt.value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-slate-600">
                  Vehicle Type (Optimization Constraint)
                  <select
                    value={form.vehicleType}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        vehicleType: e.target.value,
                        optimization: null,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    {vehicleTypeSpecs.map((spec) => (
                      <option key={spec.type} value={spec.type}>
                        {spec.label}
                        {spec.maxCapacityKg ? ` (up to ${spec.maxCapacityKg} kg)` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] font-semibold text-slate-600">
                  Scheduled Departure
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </label>
              </div>

              <div
                className={`rounded-xl border p-2.5 text-[11px] ${
                  !capacityCheck.valid
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-slate-100 bg-slate-50 text-slate-600"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{activeVehicleSpec.label}:</strong> {activeVehicleSpec.summary}
                  </span>
                  {capacityCheck.cap ? (
                    <span className="font-semibold">
                      Load: {capacityCheck.loadKg.toFixed(1)} / {capacityCheck.cap} kg
                      {capacityCheck.ratio != null ? ` (${capacityCheck.ratio}%)` : ""}
                    </span>
                  ) : (
                    <span>Load: {capacityCheck.loadKg.toFixed(1)} kg</span>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Actual driver &amp; vehicle unit assignment are handled in the separate Assignment module.
                </p>
                {!capacityCheck.valid && (
                  <p className="mt-1 text-[10px] font-semibold text-rose-700">
                    {capacityCheck.error}
                  </p>
                )}
              </div>

              <AddressFields
                title="Origin"
                point={form.origin}
                locations={locations}
                searchResults={searchResults.origin || []}
                searchBusy={searchBusy === "origin"}
                targetId="origin"
                placingTarget={placingTarget}
                onChange={(next) => setForm((prev) => ({ ...prev, origin: next }))}
                onChooseLocation={(loc) =>
                  setForm((prev) => ({
                    ...prev,
                    origin: pointFromLocation(loc, prev.origin.kind),
                  }))
                }
                onSearch={() => void handleSearchAddress("origin", form.origin.address)}
                onChooseResult={(res) => {
                  const lat = Number(
                    res.lat ?? res.properties?.lat ?? res.geometry?.coordinates?.[1]
                  );
                  const lng = Number(
                    res.lon ?? res.properties?.lon ?? res.geometry?.coordinates?.[0]
                  );
                  if (!isWithinMetroManila(lat, lng)) {
                    setFormError("Choose an address whose coordinates are within Metro Manila.");
                    setSearchResults((prev) => ({ ...prev, origin: [] }));
                    return;
                  }
                  setFormError("");
                  setForm((prev) => ({
                    ...prev,
                    origin: {
                      ...prev.origin,
                      locationId: `geocode:${Date.now()}`,
                      name:
                        prev.origin.name.trim() ||
                        String(res.display_name || res.name || "Origin").split(",")[0],
                      address: String(res.display_name || res.name || prev.origin.address),
                      lat: Number.isFinite(lat) ? lat : null,
                      lng: Number.isFinite(lng) ? lng : null,
                    },
                  }));
                  setSearchResults((prev) => ({ ...prev, origin: [] }));
                }}
                onPlace={() =>
                  setPlacingTarget((prev) => (prev === "origin" ? null : "origin"))
                }
              />

              <AddressFields
                title="Destination"
                point={form.destination}
                locations={locations}
                searchResults={searchResults.destination || []}
                searchBusy={searchBusy === "destination"}
                targetId="destination"
                placingTarget={placingTarget}
                onChange={(next) => setForm((prev) => ({ ...prev, destination: next }))}
                onChooseLocation={(loc) =>
                  setForm((prev) => ({
                    ...prev,
                    destination: pointFromLocation(loc, prev.destination.kind),
                  }))
                }
                onSearch={() =>
                  void handleSearchAddress("destination", form.destination.address)
                }
                onChooseResult={(res) => {
                  const lat = Number(
                    res.lat ?? res.properties?.lat ?? res.geometry?.coordinates?.[1]
                  );
                  const lng = Number(
                    res.lon ?? res.properties?.lon ?? res.geometry?.coordinates?.[0]
                  );
                  if (!isWithinMetroManila(lat, lng)) {
                    setFormError("Choose an address whose coordinates are within Metro Manila.");
                    setSearchResults((prev) => ({ ...prev, destination: [] }));
                    return;
                  }
                  setFormError("");
                  setForm((prev) => ({
                    ...prev,
                    destination: {
                      ...prev.destination,
                      locationId: `geocode:${Date.now()}`,
                      name:
                        prev.destination.name.trim() ||
                        String(res.display_name || res.name || "Destination").split(",")[0],
                      address: String(
                        res.display_name || res.name || prev.destination.address
                      ),
                      lat: Number.isFinite(lat) ? lat : null,
                      lng: Number.isFinite(lng) ? lng : null,
                    },
                  }));
                  setSearchResults((prev) => ({ ...prev, destination: [] }));
                }}
                onPlace={() =>
                  setPlacingTarget((prev) =>
                    prev === "destination" ? null : "destination"
                  )
                }
              />
            </div>

            {/* 3. Intermediate Stops */}
            <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  3. Intermediate Stops ({form.stops.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const s = createStop("pickup", form.purpose);
                      setForm((prev) => ({ ...prev, stops: [...prev.stops, s] }));
                      setSelectedStopId(s.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    <Plus size={12} /> Pickup Stop
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const s = createStop("delivery", form.purpose);
                      setForm((prev) => ({ ...prev, stops: [...prev.stops, s] }));
                      setSelectedStopId(s.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                  >
                    <Plus size={12} /> Delivery Stop
                  </button>
                </div>
              </div>

              {form.stops.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  No intermediate stops yet. Add a pickup or delivery stop, or pin a point on the map.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.stops.map((stop, idx) => {
                    const isSelected = stop.id === selectedStop?.id;
                    const outside =
                      Number.isFinite(stop.lat) &&
                      Number.isFinite(stop.lng) &&
                      !isWithinMetroManila(stop.lat, stop.lng);
                    return (
                      <div
                        key={stop.id}
                        className={`rounded-xl border p-3 transition ${
                          isSelected
                            ? "border-pink-300 bg-pink-50/40"
                            : "border-slate-200 bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedStopId(isSelected ? null : stop.id)}
                            className="flex flex-1 items-start gap-2 text-left"
                          >
                            <GripVertical size={14} className="mt-0.5 shrink-0 text-slate-400" />
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-bold text-slate-900">
                                  {stop.name || "Unnamed Stop"}
                                </span>
                                <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  {stop.purpose}
                                </span>
                                {outside && (
                                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                    Outside NCR
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {stop.address || "No address set"}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() =>
                                setForm((prev) => {
                                  const next = [...prev.stops];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  return { ...prev, stops: next };
                                })
                              }
                              aria-label="Move stop up"
                              className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === form.stops.length - 1}
                              onClick={() =>
                                setForm((prev) => {
                                  const next = [...prev.stops];
                                  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                  return { ...prev, stops: next };
                                })
                              }
                              aria-label="Move stop down"
                              className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  stops: prev.stops.filter((s) => s.id !== stop.id),
                                }))
                              }
                              aria-label="Delete stop"
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 border-t border-slate-200/80 pt-3">
                            <AddressFields
                              title={`Edit Stop #${idx + 1}`}
                              point={stop}
                              locations={locations}
                              searchResults={searchResults[stop.id] || []}
                              searchBusy={searchBusy === stop.id}
                              targetId={stop.id}
                              placingTarget={placingTarget}
                              onChange={(next) =>
                                setForm((prev) => ({
                                  ...prev,
                                  stops: prev.stops.map((item) =>
                                    item.id === stop.id ? { ...item, ...next } : item
                                  ),
                                }))
                              }
                              onChooseLocation={(loc) =>
                                setForm((prev) => ({
                                  ...prev,
                                  stops: prev.stops.map((item) =>
                                    item.id === stop.id
                                      ? { ...item, ...pointFromLocation(loc, item.kind) }
                                      : item
                                  ),
                                }))
                              }
                              onSearch={() => void handleSearchAddress(stop.id, stop.address)}
                              onChooseResult={(res) => {
                                const lat = Number(
                                  res.lat ?? res.properties?.lat ?? res.geometry?.coordinates?.[1]
                                );
                                const lng = Number(
                                  res.lon ?? res.properties?.lon ?? res.geometry?.coordinates?.[0]
                                );
                                if (!isWithinMetroManila(lat, lng)) {
                                  setFormError("Choose an address whose coordinates are within Metro Manila.");
                                  setSearchResults((prev) => ({ ...prev, [stop.id]: [] }));
                                  return;
                                }
                                setFormError("");
                                setForm((prev) => ({
                                  ...prev,
                                  stops: prev.stops.map((item) =>
                                    item.id === stop.id
                                      ? {
                                          ...item,
                                          locationId: `geocode:${Date.now()}`,
                                          name:
                                            item.name.trim() ||
                                            String(
                                              res.display_name || res.name || "Stop"
                                            ).split(",")[0],
                                          address: String(
                                            res.display_name || res.name || item.address
                                          ),
                                          lat: Number.isFinite(lat) ? lat : null,
                                          lng: Number.isFinite(lng) ? lng : null,
                                        }
                                      : item
                                  ),
                                }));
                                setSearchResults((prev) => ({ ...prev, [stop.id]: [] }));
                              }}
                              onPlace={() =>
                                setPlacingTarget((prev) => (prev === stop.id ? null : stop.id))
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Interactive Map + Route Summary + Business Parcels */}
          <section className="space-y-4 lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-pink-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Metro Manila Route Map ({activeTrip.label})
                  </h2>
                  {routingRoads && (
                    <span className="text-[11px] font-medium text-pink-600">
                      Calculating OSRM roads…
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-pink-700" /> Origin
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> Pickup
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-600" /> Delivery
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Destination
                  </span>
                </div>
              </div>

              <div className="relative h-[420px] w-full bg-slate-100 sm:h-[460px]">
                <LeafletMap
                  markers={mapMarkers}
                  paths={mapScope === "active" && activePolyline.length > 1 ? [activePolyline] : []}
                  coloredPaths={mapRoutePaths}
                  center={{ lat: 14.5736108, lng: 121.0329706 }}
                  zoom={12}
                  minZoom={10}
                  maxZoom={19}
                  zoomSnap={0.25}
                  zoomDelta={0.5}
                  focusKey={mapFocusKey}
                  focusPoints={mapFocusPoints}
                  focusZoom={selectedStopPoint ? 17 : undefined}
                  focusMaxZoom={selectedStopPoint ? 19 : 14}
                  onMarkerClick={(marker) => {
                    const selection = trips.flatMap((trip) => trip.form.stops.map((stop) => ({
                      trip,
                      stop,
                    }))).find(({ trip, stop }) => marker.id === `${trip.tripId}::${stop.id}`);
                    if (!selection) return;
                    setActiveTripId(selection.trip.tripId);
                    setTrips((current) => current.map((item) => item.tripId === selection.trip.tripId
                      ? { ...item, selectedStopId: selection.stop.id }
                      : item));
                  }}
                  onMapClick={(latlng: LatLng) => {
                    if (!placingTarget) return;
                    const inside = isWithinMetroManila(latlng.lat, latlng.lng);
                    if (!inside) {
                      setFormError(
                        `Pinned point (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}) is outside Metro Manila.`
                      );
                      setPlacingTarget(null);
                      return;
                    }
                    const label = `Pinned (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
                    if (placingTarget === "origin") {
                      setForm((prev) => ({
                        ...prev,
                        origin: {
                          ...prev.origin,
                          locationId: `pin:${Date.now()}`,
                          name: prev.origin.name.trim() || label,
                          address: label,
                          lat: latlng.lat,
                          lng: latlng.lng,
                        },
                      }));
                    } else if (placingTarget === "destination") {
                      setForm((prev) => ({
                        ...prev,
                        destination: {
                          ...prev.destination,
                          locationId: `pin:${Date.now()}`,
                          name: prev.destination.name.trim() || label,
                          address: label,
                          lat: latlng.lat,
                          lng: latlng.lng,
                        },
                      }));
                    } else {
                      setForm((prev) => ({
                        ...prev,
                        stops: prev.stops.map((s) =>
                          s.id === placingTarget
                            ? {
                                ...s,
                                locationId: `pin:${Date.now()}`,
                                name: s.name.trim() || label,
                                address: label,
                                lat: latlng.lat,
                                lng: latlng.lng,
                              }
                            : s
                        ),
                      }));
                    }
                    setFormError("");
                    setPlacingTarget(null);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Road Distance
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {formatKm(totalRoadKm)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Est. Duration
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {formatDuration(totalDurationMin)}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <Fuel size={11} /> Est. Fuel ({activeVehicleSpec.label})
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {estimatedFuelLiters != null
                      ? `${estimatedFuelLiters.toFixed(2)} L`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Optimizer Engine
                  </p>
                  <p className="mt-0.5 truncate text-xs font-bold text-slate-800">
                    {form.optimization?.engine || "Not yet optimized"}
                  </p>
                  {form.optimization?.fallback && (
                    <p className="text-[10px] font-medium text-amber-700">
                      Fallback active
                    </p>
                  )}
                </div>
              </div>
            </div>

            {form.purpose === "business_parcel" && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Eligible Business Parcels
                    </h3>
                    <p className="text-xs text-slate-500">
                      Attach parcels to {activeTrip.label}. Pickup-before-delivery order is preserved during optimization.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search
                        size={13}
                        className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={parcelQuery}
                        onChange={(e) => setParcelQuery(e.target.value)}
                        placeholder="Search tracking or address…"
                        className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-2.5 pl-8 text-xs text-slate-800"
                      />
                    </div>
                    <select
                      value={parcelStatusFilter}
                      onChange={(e) => setParcelStatusFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
                    >
                      <option value="all">All statuses</option>
                      <option value="booked">Booked</option>
                      <option value="picked_up">Picked up</option>
                      <option value="in_transit">In transit</option>
                    </select>
                  </div>
                </div>

                {filteredParcels.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                    No matching parcels found.
                  </p>
                ) : (
                  <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
                    {filteredParcels.slice(0, 30).map((parcel) => {
                      const checked = form.parcelIds.includes(String(parcel.id));
                      const eligible = checked || canCollectParcelOnRoute(parcel, {
                        id: form.id || activeTrip.tripId,
                        status: form.status,
                        parcel_ids: [...form.parcelIds, String(parcel.id)],
                        route_details: {
                          origin: form.origin,
                          destination: form.destination,
                          stops: form.stops,
                        },
                        route_geojson: {
                          route_geometry: {
                            coordinates: form.polyline.map(({ lat, lng }) => [lng, lat]),
                          },
                        },
                      });
                      const tracking =
                        parcel.tracking_number || parcel.trackingNumber || parcel.id;
                      const dest =
                        parcel.dropoff_location ||
                        parcel.delivery_address ||
                        parcel.destination ||
                        "Metro Manila";
                      return (
                        <label
                          key={String(parcel.id)}
                          className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs transition hover:bg-slate-50 ${
                            checked ? "bg-pink-50/40" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!eligible}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const pickupPt = parcelLocation(parcel, "pickup");
                                  const deliveryPt = parcelLocation(parcel, "delivery");
                                  if (
                                    !pickupPt ||
                                    !validPoint(pickupPt) ||
                                    !deliveryPt ||
                                    !validPoint(deliveryPt)
                                  ) {
                                    setFormError(
                                      `Parcel ${String(tracking)} needs valid pickup and delivery locations before it can be routed.`
                                    );
                                    return;
                                  }
                                  const rawWeightKg = Number(parcel.weight_kg);
                                  const weightKg = Number.isFinite(rawWeightKg) && rawWeightKg > 0
                                    ? rawWeightKg
                                    : undefined;
                                  const addedStops: RouteStop[] = [];
                                  addedStops.push({
                                    ...pickupPt,
                                    id: `stop-pickup-${parcel.id}-${crypto.randomUUID().slice(0, 6)}`,
                                    purpose: "Parcel pickup",
                                    arrival: "",
                                    departure: "",
                                    durationMinutes: 10,
                                    instructions: `Collect ${String(tracking)}`,
                                    parcelReference: String(tracking),
                                    weightKg,
                                    parcelEvents: [
                                      {
                                        parcelId: String(parcel.id),
                                        trackingNumber: String(tracking),
                                        kind: "pickup",
                                        weightKg,
                                      },
                                    ],
                                  });
                                  addedStops.push({
                                    ...deliveryPt,
                                    id: `stop-delivery-${parcel.id}-${crypto.randomUUID().slice(0, 6)}`,
                                    purpose: "Parcel delivery",
                                    arrival: "",
                                    departure: "",
                                    durationMinutes: 10,
                                    instructions: `Deliver ${String(tracking)}`,
                                    parcelReference: String(tracking),
                                    weightKg,
                                    parcelEvents: [
                                      {
                                        parcelId: String(parcel.id),
                                        trackingNumber: String(tracking),
                                        kind: "delivery",
                                        weightKg,
                                      },
                                    ],
                                  });
                                  setFormError("");
                                  setForm((prev) => ({
                                    ...prev,
                                    parcelIds: [...prev.parcelIds, String(parcel.id)],
                                    stops: [...prev.stops, ...addedStops],
                                  }));
                                } else {
                                  setForm((prev) => ({
                                    ...prev,
                                    parcelIds: prev.parcelIds.filter(
                                      (id) => id !== String(parcel.id)
                                    ),
                                    stops: prev.stops.filter(
                                      (s) =>
                                        !s.parcelEvents?.some(
                                          (ev) => ev.parcelId === String(parcel.id)
                                        )
                                    ),
                                  }));
                                }
                              }}
                              className="mt-0.5 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {String(tracking)}
                                </span>
                                <StatusBadge status={String(parcel.status || "booked")} />
                                {parcel.weight_kg != null && (
                                  <span className="text-[11px] text-slate-500">
                                    {Number(parcel.weight_kg)} kg
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                To: {String(dest)}
                              </p>
                              {!eligible && (
                                <p className="text-[10px] text-amber-700">
                                  Pickup must be on this route, and the parcel must be open and uncollected.
                                </p>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      ) : (
        /* Saved Plans & History */
        <section className="mx-auto max-w-[1600px] space-y-4 p-4 sm:p-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Saved Route Plans &amp; History
                </h2>
                <p className="text-xs text-slate-500">
                  Inspect persisted route plans, load them into a trip, or delete obsolete plans.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={savedRouteQuery}
                    onChange={(e) => setSavedRouteQuery(e.target.value)}
                    placeholder="Search route plans…"
                    className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-800"
                  />
                </div>
                <select
                  value={purposeFilter}
                  onChange={(e) =>
                    setPurposeFilter(e.target.value as "all" | TransportPurpose)
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                >
                  <option value="all">All purposes</option>
                  <option value="business_parcel">Business Parcel</option>
                  <option value="company_supply">Company Supply</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                >
                  <option value="all">All statuses</option>
                  {PLAN_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <select
                  value={routeTypeFilter}
                  onChange={(e) => setRouteTypeFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                >
                  <option value="all">All route types</option>
                  {ROUTE_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredPlans.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                No saved route plans match the current filter.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 pr-3">Route Plan</th>
                      <th className="px-3 py-2.5">Purpose</th>
                      <th className="px-3 py-2.5">Origin → Destination</th>
                      <th className="px-3 py-2.5">Stops</th>
                      <th className="px-3 py-2.5">Scheduled</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="py-2.5 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPlans.map((plan) => {
                      const details = planDetails(plan);
                      const purpose = inferPurposeFromPlan(plan);
                      const originLabel =
                        details.origin?.name || details.origin?.address || "—";
                      const destLabel =
                        details.destination?.name || details.destination?.address || "—";
                      const stopCount = Array.isArray(details.stops)
                        ? details.stops.length
                        : 0;
                      return (
                        <tr key={String(plan.id)} className="hover:bg-slate-50/80">
                          <td className="py-3 pr-3 font-bold text-slate-900">
                            {String(plan.name || plan.route_name || `Route ${plan.id}`)}
                          </td>
                          <td className="px-3 py-3">
                            <PurposeBadge purpose={purpose} />
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {String(originLabel)} → {String(destLabel)}
                          </td>
                          <td className="px-3 py-3 text-slate-700">{stopCount}</td>
                          <td className="px-3 py-3 text-slate-500">
                            {formatDate(plan.scheduled_at)}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={mapRouteStatusToUi(plan)} />
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setInspectPlan(plan)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLoadPlanIntoTrip(plan)}
                                className="inline-flex items-center gap-1 rounded-lg border border-pink-200 bg-pink-50 px-2.5 py-1 text-[11px] font-semibold text-pink-700 hover:bg-pink-100"
                              >
                                <Eye size={12} /> Load into {activeTrip.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(plan)}
                                aria-label={`Delete plan ${String(plan.name || plan.id)}`}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {inspectPlan && (
        <Modal
          title={String(inspectPlan.name || inspectPlan.route_name || "Route Plan Details")}
          onClose={() => setInspectPlan(null)}
        >
          <div className="space-y-3 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <PurposeBadge purpose={inferPurposeFromPlan(inspectPlan)} />
              <StatusBadge status={mapRouteStatusToUi(inspectPlan)} />
              <span className="text-slate-500">
                Scheduled: {formatDate(inspectPlan.scheduled_at)}
              </span>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p>
                <strong>Origin:</strong>{" "}
                {planDetails(inspectPlan).origin?.name ||
                  planDetails(inspectPlan).origin?.address ||
                  "—"}
              </p>
              <p className="mt-1">
                <strong>Destination:</strong>{" "}
                {planDetails(inspectPlan).destination?.name ||
                  planDetails(inspectPlan).destination?.address ||
                  "—"}
              </p>
              <p className="mt-1">
                <strong>Intermediate Stops:</strong>{" "}
                {planDetails(inspectPlan).stops?.length ?? 0}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInspectPlan(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleLoadPlanIntoTrip(inspectPlan)}
                className="rounded-lg bg-pink-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-pink-700"
              >
                Load into {activeTrip.label}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete Saved Route Plan?"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="space-y-4 text-xs text-slate-700">
            <p>
              Are you sure you want to delete{" "}
              <strong>
                {String(deleteTarget.name || deleteTarget.route_name || deleteTarget.id)}
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPlan}
                onClick={() => void handleConfirmDeletePlan()}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingPlan ? "Deleting…" : "Delete Plan"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Map-first layout for the FTM Route Planning page.
 * Presentation only: no data fetching, optimizer, OSRM or save logic lives here,
 * so the existing state and API calls in RoutePlanningWorkspace stay as they are.
 */
export type TripCardData = {
  id: string;
  label: string;
  purpose: "company_supply" | "business_parcel";
  stopCount: number;
  distanceKm: number | null;
  saved: boolean;
};

const PURPOSE_STYLE = {
  company_supply: { bar: "bg-indigo-500", icon: Building2, name: "Company supply" },
  business_parcel: { bar: "bg-pink-500", icon: Package, name: "Business parcel" },
} as const;

export function TripRail({
  trips,
  activeId,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
}: {
  trips: TripCardData[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <nav aria-label="Trips" className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {trips.map((trip) => {
        const active = trip.id === activeId;
        const style = PURPOSE_STYLE[trip.purpose];
        const Icon = style.icon;
        return (
          <div
            key={trip.id}
            className={`group relative flex min-w-[168px] items-stretch overflow-hidden rounded-xl border bg-white transition ${
              active ? "border-slate-900 shadow-sm" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className={`w-1.5 shrink-0 ${style.bar}`} aria-hidden />
            <button
              type="button"
              onClick={() => onSelect(trip.id)}
              aria-current={active ? "true" : undefined}
              className="flex-1 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-pink-500"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Icon size={13} className="text-slate-500" />
                {trip.label}
                {!trip.saved && <span className="size-1.5 rounded-full bg-amber-400" title="Unsaved" />}
              </span>
              <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
                {trip.stopCount} {trip.stopCount === 1 ? "stop" : "stops"}
                {trip.distanceKm != null ? `, ${trip.distanceKm.toFixed(1)} km` : ""}
              </span>
            </button>
            {trips.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(trip.id)}
                aria-label={`Remove ${trip.label}`}
                className="px-2 text-slate-300 hover:text-rose-600 focus-visible:text-rose-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex min-w-[96px] items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:border-pink-400 hover:text-pink-700"
      >
        <Plus size={14} /> Add trip
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        className="flex items-center justify-center gap-1 rounded-xl px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <Copy size={13} /> Duplicate
      </button>
    </nav>
  );
}

export function CapacityMeter({ loadKg, capacityKg }: { loadKg: number; capacityKg: number | null }) {
  if (!capacityKg) {
    return <span className="text-sm font-semibold tabular-nums text-slate-900">{loadKg.toFixed(1)} kg</span>;
  }
  const ratio = loadKg / capacityKg;
  const tone = ratio > 1 ? "bg-rose-500" : ratio > 0.85 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-slate-900">{loadKg.toFixed(1)} kg</span>
        <span className={`text-xs tabular-nums ${ratio > 1 ? "font-semibold text-rose-600" : "text-slate-500"}`}>
          of {capacityKg}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Vehicle load"
        aria-valuemin={0}
        aria-valuemax={capacityKg}
        aria-valuenow={Math.round(loadKg)}
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
    </div>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export function RouteSummaryBar({
  distanceKm,
  durationLabel,
  fuelLiters,
  vehicleLabel,
  loadKg,
  capacityKg,
  engine,
  fallback,
}: {
  distanceKm: string;
  durationLabel: string;
  fuelLiters: number | null;
  vehicleLabel: string;
  loadKg: number;
  capacityKg: number | null;
  engine: string | null;
  fallback: boolean;
}) {
  const value = "text-sm font-semibold tabular-nums text-slate-900";
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:grid-cols-5">
      <Metric label="Road distance"><span className={value}>{distanceKm}</span></Metric>
      <Metric label="Travel time"><span className={value}>{durationLabel}</span></Metric>
      <Metric label={`Fuel (${vehicleLabel})`}>
        <span className={`${value} inline-flex items-center gap-1`}>
          <Fuel size={12} className="text-slate-400" />
          {fuelLiters != null ? `${fuelLiters.toFixed(1)} L` : "n/a"}
        </span>
      </Metric>
      <Metric label="Load"><CapacityMeter loadKg={loadKg} capacityKg={capacityKg} /></Metric>
      <Metric label="Optimizer">
        {engine ? (
          <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
            <span className="truncate">{engine}</span>
            {fallback && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                <AlertTriangle size={10} /> Fallback
              </span>
            )}
          </span>
        ) : (
          <span className="text-sm text-slate-400">Not optimized yet</span>
        )}
      </Metric>
    </dl>
  );
}

export type PanelTab = { id: string; label: string; count?: number };

export function PanelTabs({
  tabs,
  active,
  onChange,
  children,
}: {
  tabs: PanelTab[];
  active: string;
  onChange: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white">
      <div role="tablist" aria-label="Route setup" className="flex gap-1 border-b border-slate-200 p-1.5">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-pink-500 ${
                selected ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
              {tab.count != null && (
                <span className={`ml-1.5 text-xs tabular-nums ${selected ? "text-slate-300" : "text-slate-400"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="flex-1 space-y-3 overflow-y-auto p-3"
      >
        {children}
      </div>
    </div>
  );
}

/** Left: setup panel. Right: sticky map with the summary floating over its bottom edge. */
export function PlannerLayout({
  tripRail,
  notices,
  panel,
  map,
  summary,
}: {
  tripRail: ReactNode;
  notices?: ReactNode;
  panel: ReactNode;
  map: ReactNode;
  summary: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1680px] space-y-3 p-3 sm:p-5">
      {tripRail}
      {notices && <div className="space-y-2">{notices}</div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]">
        <section aria-label="Route setup" className="lg:h-[calc(100vh-13rem)] lg:min-h-[560px]">
          {panel}
        </section>
        <section
          aria-label="Route map"
          className="relative h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 lg:sticky lg:top-24 lg:h-[calc(100vh-13rem)] lg:min-h-[560px]"
        >
          {map}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500]">
            <div className="pointer-events-auto">{summary}</div>
          </div>
        </section>
      </div>
    </main>
  );
}