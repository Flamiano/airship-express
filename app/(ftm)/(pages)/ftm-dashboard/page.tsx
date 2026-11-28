"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GlobalNavbar from "../../components/global/GlobalNavbar";
import GlobalFooter from "../../components/global/GlobalFooter";
import { firstNameOf, useFtmProfile } from "../../components/global/useFtmProfile";
import { getAllowedNavPaths } from "../../lib/permissions";
import { fetchJson } from "../../lib/api";
import SpecializedLogistics from "./components/SpecializedLogistics";
import PerformanceMetrics from "./components/PerformanceMetrics";
import MissionLogs from "./components/MissionLogs";
import ResourceData from "./components/ResourceData";
import SensorHub from "./components/SensorHub";
import MapSection from "./components/MapSection";
import { isCompletedTripStatus, isOperationalTrip } from "../../lib/parcelTypes";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ComposedChart,
} from "recharts";

export type DashboardVehicle = {
  id?: string;
  vehicle_id?: string | null;
  plate_number?: string | null;
  plateNumber?: string | null;
  vehicleType?: string | null;
  vehicle_type?: string | null;
  status?: string | null;
  availability?: string | null;
  driver_id?: string | null;
  driver?: string | null;
  driverName?: string | null;
  capacityKg?: number | null;
  locationLat?: number | null;
  locationLng?: number | null;
  locationRecordedAt?: string | null;
  locationSource?: string | null;
};

export type DashboardTrip = {
  id?: string;
  status?: string | null;
  driverId?: string | null;
  driver_id?: string | null;
  driver?: string | null;
  driverName?: string | null;
  progress?: number | null;
  vehicleId?: string | null;
  vehicle_id?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  pickup_location?: string | null;
  destination_location?: string | null;
  pickup_zone?: string | null;
  destination_zone?: string | null;
  fromCoords?: { lat: number; lng: number } | null;
  toCoords?: { lat: number; lng: number } | null;
  from_latitude?: number | null;
  from_longitude?: number | null;
  to_latitude?: number | null;
  to_longitude?: number | null;
  stops?: Array<{
    id?: string | null;
    name?: string | null;
    label?: string | null;
    lat?: number | null;
    lng?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    status?: string | null;
  }> | null;
  routePlanStops?: Array<{
    id?: string | null;
    name?: string | null;
    label?: string | null;
    lat?: number | null;
    lng?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    status?: string | null;
  }> | null;
  loadKg?: number | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  actual_arrival?: string | null;
  actualArrival?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  delivered_at?: string | null;
  deliveredAt?: string | null;
  estimated_arrival?: string | null;
  eta_at?: string | null;
  actual_departure?: string | null;
  routePlan?: {
    routeDetails?: { schedule?: { window_end?: string | null; expected_arrival?: string | null } | null } | null;
    route_details?: { schedule?: { window_end?: string | null; expected_arrival?: string | null } | null } | null;
  } | null;
  route_plan?: {
    routeDetails?: { schedule?: { window_end?: string | null; expected_arrival?: string | null } | null } | null;
    route_details?: { schedule?: { window_end?: string | null; expected_arrival?: string | null } | null } | null;
  } | null;
  actual_distance_km?: number | string | null;
  odometer_start_km?: number | string | null;
  odometer_end_km?: number | string | null;
  actual_fuel_consumed_liters?: number | string | null;
  fuel_consumed_liters?: number | string | null;
  consumed_liters?: number | string | null;
  fuel_used_liters?: number | string | null;
  currentLocation?: { lat: number; lng: number; recorded_at?: string | null; source?: string; is_fresh?: boolean } | null;
  proof_of_delivery?: DeliveryProof | null;
  proofOfDelivery?: DeliveryProof | null;
  events?: Array<{ status?: string | null; remarks?: string | null; created_at?: string | null }>;
  pickup_proof_url?: string | null;
};

type DeliveryProof = {
  delivery_photo_url?: string | null;
  receiver_signature_url?: string | null;
  receiver_name?: string | null;
  delivered_at?: string | null;
};

type DashboardDriver = {
  id?: string | number | null;
  driver_id?: string | number | null;
  user_id?: string | number | null;
  full_name?: string | null;
  fullName?: string | null;
  name?: string | null;
  displayName?: string | null;
  vehicle_id?: string | number | null;
  safetyScore?: number | string | null;
  safety_score?: number | string | null;
  rating?: number | string | null;
  performanceScore?: number | string | null;
};

type DashboardParcel = {
  id?: string | number | null;
  bookingId?: string | number | null;
  booking_id?: string | number | null;
  tripId?: string | number | null;
  trip_id?: string | number | null;
  routePlanId?: string | number | null;
  route_plan_id?: string | number | null;
  courier?: string | null;
  trackingNumber?: string | null;
  tracking_number?: string | null;
  recipientName?: string | null;
  recipient_name?: string | null;
  parcelType?: string | null;
  type?: string | null;
  destinationAddress?: string | null;
  address?: string | null;
  dropoffAddress?: string | null;
  weight_kg?: number | string | null;
};

type DashboardCostEntry = {
  category?: string | null;
  amount?: number | string | null;
  cost?: number | string | null;
};

type DashboardFuelLog = {
  liters?: number | string | null;
};

export type DashboardBooking = {
  id?: string;
  status?: string | null;
  created_at?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
};

export type DashboardSnapshot = {
  vehicles: DashboardVehicle[];
  trips: DashboardTrip[];
  bookings: DashboardBooking[];
  routePlans?: Array<Record<string, unknown>>;
  sourceErrors?: string[];
  drivers: DashboardDriver[];
};
// Helper functions to calculate real data from API
function getMeasuredTripFuelLiters(trip: DashboardTrip) {
  const liters = Number(trip.actual_fuel_consumed_liters ?? trip.fuel_consumed_liters ?? trip.consumed_liters ?? trip.fuel_used_liters);
  return Number.isFinite(liters) && liters > 0 ? liters : null;
}

function getMeasuredTripDistanceKm(trip: DashboardTrip) {
  const actualDistance = Number(trip.actual_distance_km);
  if (Number.isFinite(actualDistance) && actualDistance > 0) return actualDistance;
  const start = Number(trip.odometer_start_km);
  const end = Number(trip.odometer_end_km);
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start ? end - start : null;
}

const calculateFuelConsumptionData = (trips: DashboardTrip[]) => {
  const litersByDate = new Map<string, number>();
  trips.forEach((trip) => {
    const liters = getMeasuredTripFuelLiters(trip);
    const rawDate = trip.actual_arrival || trip.actual_departure || trip.updatedAt || trip.updated_at || trip.createdAt || trip.created_at;
    if (liters == null || !rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    litersByDate.set(key, (litersByDate.get(key) || 0) + liters);
  });
  if (!litersByDate.size) return [];
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { day: date.toLocaleDateString("en-PH", { weekday: "short" }), consumption: litersByDate.get(key) ?? null };
  });
};

const isFuelCategory = (value?: string | null) => /fuel|energy/i.test(String(value ?? ""));

function isDashboardCompletedTrip(trip: DashboardTrip) {
  return /^(complete|completed|delivered|finished|arrived)$/i.test(String(trip.status || "").trim().replace(/[_-]+/g, " "));
}

function tripCompletionTime(trip: DashboardTrip) {
  const value = trip.actual_arrival ?? trip.actualArrival ?? trip.completed_at ?? trip.completedAt
    ?? trip.delivered_at ?? trip.deliveredAt ?? trip.proof_of_delivery?.delivered_at
    ?? trip.proofOfDelivery?.delivered_at;
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function tripDeliveryDeadline(trip: DashboardTrip) {
  const plan = trip.routePlan ?? trip.route_plan;
  const value = plan?.routeDetails?.schedule?.window_end ?? plan?.route_details?.schedule?.window_end;
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function onTimeOutcome(trip: DashboardTrip) {
  if (!isDashboardCompletedTrip(trip)) return null;
  const completedAt = tripCompletionTime(trip);
  const deadline = tripDeliveryDeadline(trip);
  return completedAt && deadline ? completedAt.getTime() <= deadline.getTime() : null;
}

const calculateCostBreakdownData = (costEntries: DashboardCostEntry[]) => {
  const breakdown: Record<string, number> = {
    "Fuel & Energy": 0,
    "Maintenance": 0,
    "Driver Payroll": 0,
    "Insurance & Tolls": 0,
  };

  costEntries.forEach(entry => {
    const category = entry.category || "Other";
    const amount = Number(entry.amount ?? entry.cost ?? 0);
    if (!Number.isFinite(amount)) return;
    if (isFuelCategory(category)) breakdown["Fuel & Energy"] += amount;
    else if (category.toLowerCase().includes("maintenance") || category.toLowerCase().includes("service")) breakdown.Maintenance += amount;
    else if (category.toLowerCase().includes("payroll") || category.toLowerCase().includes("driver")) breakdown["Driver Payroll"] += amount;
    else if (category.toLowerCase().includes("toll") || category.toLowerCase().includes("insurance")) breakdown["Insurance & Tolls"] += amount;
  });

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  return Object.entries(breakdown)
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({
      name,
      amount,
      value: Math.round((amount / total) * 100),
      color: name === "Fuel & Energy" ? "#b80049" : name === "Maintenance" ? "#ec2188" : name === "Driver Payroll" ? "#f472b6" : "#fda4af",
    }));
};

const calculateFleetUtilizationData = (vehicles: DashboardVehicle[]) => {
  const vehiclesByType = new Map<string, { active?: number; idle?: number; maintenance?: number }>();
  vehicles.forEach((vehicle) => {
    const category = String(vehicle.vehicleType || vehicle.vehicle_type || "").trim();
    const status = String(vehicle.status || vehicle.availability || "").trim().toLowerCase().replace(/[_-]+/g, " ");
    if (!category) return;
    const state = /maintenance|service|repair|out of service/.test(status)
      ? "maintenance"
      : /available|idle|ready|standby|free/.test(status)
        ? "idle"
        : /active|moving|in transit|assigned|on trip|in use/.test(status)
          ? "active"
          : null;
    if (!state) return;
    const counts = vehiclesByType.get(category) || {};
    counts[state] = (counts[state] || 0) + 1;
    vehiclesByType.set(category, counts);
  });
  return [...vehiclesByType].map(([category, counts]) => ({ category, ...counts }));
};

const calculateDeliveryPerformanceData = (trips: DashboardTrip[]) => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    const validOutcomes = trips.filter((trip) => {
      const date = tripCompletionTime(trip);
      return date && date >= monthDate && date < nextMonth && onTimeOutcome(trip) != null;
    }).map(onTimeOutcome).filter((value): value is boolean => value !== null);
    if (!validOutcomes.length) return null;
    const onTimeCount = validOutcomes.filter(Boolean).length;
    return {
      month: monthDate.toLocaleDateString("en-US", { month: "short" }),
      onTime: Number((onTimeCount / validOutcomes.length * 100).toFixed(1)),
      delayed: Number(((validOutcomes.length - onTimeCount) / validOutcomes.length * 100).toFixed(1)),
    };
  }).filter((month): month is NonNullable<typeof month> => month !== null);
};

const calculateWarehouseThroughputData = (bookings: DashboardBooking[]) => {
  return [6, 9, 12, 15, 18, 21].map((hour) => {
    const inWindow = bookings.filter((booking) => {
      const date = booking.created_at ? new Date(booking.created_at) : null;
      return date && !Number.isNaN(date.getTime()) && date.getHours() >= hour && date.getHours() < hour + 3;
    });
    const outbound = inWindow.filter((booking) => /dispatched|assigned|in transit|delivered/i.test(String(booking.status ?? ""))).length;
    return { hour: `${String(hour).padStart(2, "0")}:00`, inbound: inWindow.length, outbound, capacity: bookings.length };
  });
};

const calculateDriverPerformanceData = (trips: DashboardTrip[], drivers: DashboardDriver[]) => {
  const driverNames = new Map<string, string>();
  drivers.forEach((driver) => {
    const ids = [driver.id, driver.driver_id, driver.user_id].filter(Boolean).map(String);
    const name = driver.full_name || driver.fullName || driver.name || driver.displayName;
    if (name) ids.forEach((id) => driverNames.set(id, String(name)));
  });
  const performance = new Map<string, { completed: number; delayed: number; active: number }>();
  trips.forEach((trip) => {
    const driverId = trip.driverId || trip.driver_id;
    const tripLabel = trip.driverName || trip.driver;
    const isIdentifier = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(value || ""));
    const driver = (driverId ? driverNames.get(String(driverId)) : null)
      || (!isIdentifier(tripLabel) ? tripLabel : null);
    const displayName = driver || "Unassigned driver";
    const entry = performance.get(displayName) || { completed: 0, delayed: 0, active: 0 };
    const status = String(trip.status ?? "").toLowerCase();
    if (/completed|delivered|arrived/.test(status)) entry.completed += 1;
    else if (/delayed|late|exception/.test(status)) entry.delayed += 1;
    else entry.active += 1;
    performance.set(displayName, entry);
  });

  return Array.from(performance.entries())
    .sort(([, first], [, second]) => (second.completed + second.active) - (first.completed + first.active))
    .slice(0, 5)
    .map(([driver, data]) => ({ driver: driver.length > 16 ? `${driver.slice(0, 13)}...` : driver, ...data }));
};


// ---- Side-menu dashboard helpers (sparklines, week-over-week, fleet status donut) ----
function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function tripCreatedAt(trip: DashboardTrip) {
  return parseDate(trip.createdAt ?? trip.created_at ?? null);
}

function inRange(date: Date | null, start: Date, end: Date) {
  return !!date && date >= start && date < end;
}

/** One value per calendar day, oldest first, ending today. */
function dailySeries<T>(now: Date, days: number, valueFor: (start: Date, end: Date) => T): T[] {
  return Array.from({ length: days }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    return valueFor(start, end);
  });
}

function carryForward(values: Array<number | null>): number[] {
  let last = 0;
  return values.map((value) => {
    if (value != null) last = value;
    return last;
  });
}

/** Last 7 days vs the 7 before; null when there is nothing to compare against. */
function weekOverWeek(series: number[], average = false) {
  const recent = series.slice(-7);
  const previous = series.slice(-14, -7);
  const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / (average ? Math.max(values.length, 1) : 1);
  const before = total(previous);
  if (!before) return null;
  const change = ((total(recent) - before) / before) * 100;
  const rounded = Math.round(change * 10) / 10;
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded)}%`;
}

function Sparkline({ values, title }: { values: number[]; title: string }) {
  const data = values.slice(-8);
  const width = 120;
  const height = 36;
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const points = data.map((value, index) => [
    index * (width / Math.max(data.length - 1, 1)),
    height - 4 - ((value - min) / (max - min || 1)) * (height - 8),
  ]);
  const path = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <linearGradient id="ftmSparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#b80049" stopOpacity="0.25" />
          <stop offset="1" stopColor="#b80049" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${width} ${height} L0 ${height}Z`} fill="url(#ftmSparkFill)" />
      <path d={path} fill="none" stroke="#b80049" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

type DonutPart = { label: string; count: number; percent: number; color: string };

function Donut({ parts, size, thickness }: { parts: DonutPart[]; size: number; thickness: number }) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = parts.reduce((sum, part) => sum + part.count, 0) || 1;
  const segments = parts.map((part, index) => ({
    part,
    length: (circumference * part.count) / total,
    offset: (circumference * parts.slice(0, index).reduce((sum, previous) => sum + previous.count, 0)) / total,
  }));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f6e9ef" strokeWidth={thickness} />
      {segments.map(({ part, length, offset }) => (
        <circle
          key={part.label}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={part.color}
          strokeWidth={thickness}
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  );
}

/** Same status buckets as calculateFleetUtilizationData, across the whole fleet. */
function calculateFleetStatus(vehicles: DashboardVehicle[]) {
  const counts = { inUse: 0, available: 0, maintenance: 0, other: 0 };
  vehicles.forEach((vehicle) => {
    const status = String(vehicle.status || vehicle.availability || "").trim().toLowerCase().replace(/[_-]+/g, " ");
    if (/maintenance|service|repair|out of service/.test(status)) counts.maintenance += 1;
    else if (/available|idle|ready|standby|free/.test(status)) counts.available += 1;
    else if (/active|moving|in transit|assigned|on trip|in use/.test(status)) counts.inUse += 1;
    else counts.other += 1;
  });
  const total = vehicles.length;
  const pct = (count: number) => (total ? Math.round((count / total) * 100) : 0);
  const parts: DonutPart[] = [
    { label: "In use", count: counts.inUse, percent: pct(counts.inUse), color: "#b80049" },
    { label: "Available", count: counts.available, percent: pct(counts.available), color: "#10b981" },
    { label: "Maintenance", count: counts.maintenance, percent: pct(counts.maintenance), color: "#f59e0b" },
  ];
  if (counts.other) parts.push({ label: "Other", count: counts.other, percent: pct(counts.other), color: "#cbd5e1" });
  return { total, utilized: pct(counts.inUse), parts };
}

const KPI_IDS = [
  "active-vehicles",
  "in-transit",
  "pending-bookings",
  "total-vehicles",
  "completed-trips",
  "total-bookings",
  "total-drivers",
  "fleet-efficiency",
  "on-time-rate",
  "system-health",
  "total-parcels",
  "total-fuel",
  "operating-cost",
  "driver-allowance",
  "mobile-data",
] as const;

export default function Home() {
  const [dashboardFullscreen, setDashboardFullscreen] = useState(false);
  const profile = useFtmProfile();
  const [hiddenKPIs, setHiddenKPIs] = useState<Set<string>>(new Set(KPI_IDS));

  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    vehicles: [],
    trips: [],
    bookings: [],
    routePlans: [],
    drivers: [],
  });
  const [fuelLogs, setFuelLogs] = useState<DashboardFuelLog[]>([]);
  const [costEntries, setCostEntries] = useState<DashboardCostEntry[]>([]);
  const [parcels, setParcels] = useState<DashboardParcel[]>([]);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const loadSnapshot = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const data = await fetchJson("/api/dashboard", { cache: "no-store" });
        if (!active) return;
        setSnapshot({
          vehicles: Array.isArray(data.vehicles) ? data.vehicles : [],
          trips: Array.isArray(data.trips) ? data.trips : [],
          bookings: Array.isArray(data.bookings) ? data.bookings : [],
          routePlans: Array.isArray(data.routePlans) ? data.routePlans : [],
          drivers: Array.isArray(data.drivers) ? data.drivers : [],
        });
        setParcels(Array.isArray(data.parcels) ? data.parcels : []);
        setFuelLogs(Array.isArray(data.fuelLogs) ? data.fuelLogs : []);
        setCostEntries(Array.isArray(data.costEntries) ? data.costEntries : []);
        setSourceErrors(Array.isArray(data.sourceErrors) ? data.sourceErrors : []);
        setError(null);
      } catch (requestError) {
        console.error("Failed to load dashboard data:", requestError);
        if (active) setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard data.");
      } finally {
        requestInFlight = false;
      }
    };

    void loadSnapshot();
    const intervalId = window.setInterval(() => void loadSnapshot(), 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadSnapshot();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const handleDashboardShortcuts = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setHiddenKPIs(new Set());
      } else if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setHiddenKPIs(new Set(KPI_IDS));
      }
    };

    window.addEventListener("keydown", handleDashboardShortcuts);
    return () => window.removeEventListener("keydown", handleDashboardShortcuts);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50/70 via-white to-rose-50/50 p-6 text-slate-800 font-sans">
        <div className="w-full max-w-md rounded-3xl border border-pink-100 bg-white/90 backdrop-blur-md p-8 text-center shadow-xl shadow-pink-500/10">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[28px]">signal_cellular_connected_no_internet_4_bar</span>
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">Dashboard Stream Disrupted</h1>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            {error || "Live telemetry stream is currently unavailable. Check system connectivity."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-pink-600/25 hover:from-pink-700 hover:to-rose-700 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Reconnect Stream
          </button>
        </div>
      </div>
    );
  }

  const uniqueVehicles = Array.from(new Map(snapshot.vehicles.filter((vehicle) => vehicle.id)
    .map((vehicle) => [String(vehicle.id), vehicle])).values());
  const uniqueTrips = Array.from(new Map(snapshot.trips
    .filter((trip) => trip.id)
    .map((trip) => [String(trip.id), trip])).values());
  const activeTrips = uniqueTrips.filter((trip) => isOperationalTrip({ id: trip.id, status: trip.status }));
  const activeTripsCount = activeTrips.length;
  const activeVehiclesCount = uniqueVehicles.filter((vehicle) => /^(active|moving|in transit|assigned)$/i.test(String(vehicle.status ?? "").replace(/[_-]+/g, " ").trim())).length;
  const pendingBookingsCount = snapshot.bookings.filter((booking) => /^pending$/i.test(String(booking.status ?? "").trim())).length;
  const totalVehiclesCount = uniqueVehicles.length;
  const totalTripsCount = uniqueTrips.length;
  const totalBookingsCount = snapshot.bookings.length;
  const totalDriversCount = new Set(snapshot.drivers.map((driver) => driver.id).filter(Boolean)).size;

  // Calculate real metrics
  const fuelConsumptionData = calculateFuelConsumptionData(uniqueTrips);
  const costBreakdownData = calculateCostBreakdownData(costEntries);
  const fleetUtilizationData = calculateFleetUtilizationData(uniqueVehicles);
  const deliveryPerformanceData = calculateDeliveryPerformanceData(uniqueTrips);
  const warehouseThroughputData = calculateWarehouseThroughputData(snapshot.bookings);
  const driverPerformanceData = calculateDriverPerformanceData(uniqueTrips, snapshot.drivers);

  // Calculate KPI values from real data
  const pairedFuelMeasurements = uniqueTrips.map((trip) => ({
    distanceKm: getMeasuredTripDistanceKm(trip),
    liters: getMeasuredTripFuelLiters(trip),
  })).filter((measurement) => measurement.distanceKm != null && measurement.distanceKm > 0 && measurement.liters != null && measurement.liters > 0);
  const efficiencyDistanceKm = pairedFuelMeasurements.reduce((sum, measurement) => sum + (measurement.distanceKm || 0), 0);
  const efficiencyFuelLiters = pairedFuelMeasurements.reduce((sum, measurement) => sum + (measurement.liters || 0), 0);
  const fleetEfficiency = efficiencyFuelLiters > 0 ? (efficiencyDistanceKm / efficiencyFuelLiters).toFixed(1) : "No data available";
  
  const completedTripRows = uniqueTrips.filter((trip) => isCompletedTripStatus(trip.status));
  const completedTrips = completedTripRows.length;
  const validOnTimeOutcomes = completedTripRows.map(onTimeOutcome).filter((value): value is boolean => value !== null);
  const onTimeRate = validOnTimeOutcomes.length
    ? (validOnTimeOutcomes.filter(Boolean).length / validOnTimeOutcomes.length * 100).toFixed(1)
    : null;
  
  const systemHealth = snapshot.vehicles.length > 0 && snapshot.trips.length > 0
    ? "Optimal" 
    : (snapshot.vehicles.length > 0 ? "Good" : "Offline");

  // Calculate parcel-related KPI values
  const totalParcelsCount = parcels.length;
  // Calculate fuel management KPI values
  const totalFuelReported = fuelLogs.reduce((sum, log) => sum + (Number(log.liters) || 0), 0);
  // Calculate cost analysis KPI values
  const totalOperatingCost = costEntries.reduce((sum, entry) => sum + (Number(entry.amount ?? entry.cost ?? 0) || 0), 0);
  const driverAllowanceCost = costEntries.filter((entry) => /driver\s*allowance|allowance/i.test(String(entry.category || ""))).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const mobileDataCost = costEntries.filter((entry) => /mobile\s*data|data\s*(?:&|and)?\s*internet|internet/i.test(String(entry.category || ""))).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const snapshotPercentage = (count: number, total: number) =>
    total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "—";
  const kpiPercentages: Record<string, string> = {
    "active-vehicles": snapshotPercentage(activeVehiclesCount, totalVehiclesCount),
    "in-transit": snapshotPercentage(activeTripsCount, totalTripsCount),
    "pending-bookings": snapshotPercentage(pendingBookingsCount, totalBookingsCount),
    "total-vehicles": totalVehiclesCount > 0 ? "100%" : "—",
    "completed-trips": snapshotPercentage(completedTrips, totalTripsCount),
    "total-bookings": totalBookingsCount > 0 ? "100%" : "—",
    "total-drivers": totalDriversCount > 0 ? "100%" : "—",
    "fleet-efficiency": "—",
    "on-time-rate": onTimeRate == null ? "—" : `${onTimeRate}%`,
    "system-health": "—",
    "total-parcels": totalParcelsCount > 0 ? "100%" : "—",
    "total-fuel": "—",
    "operating-cost": "—",
  };

  const toggleKPIVisibility = (kpiId: string) => {
    const newHidden = new Set(hiddenKPIs);
    if (newHidden.has(kpiId)) {
      newHidden.delete(kpiId);
    } else {
      newHidden.add(kpiId);
    }
    setHiddenKPIs(newHidden);
  };

  const renderKPIValue = (kpiId: string, value: string | number) => {
    if (hiddenKPIs.has(kpiId)) {
      return "***";
    }
    return value;
  };

  const renderKPITrend = (kpiId: string) => (
    <span className="ml-1 text-[10px] font-bold text-slate-400" title="Current snapshot percentage">
      → {kpiPercentages[kpiId] ?? "—"}
    </span>
  );

  const allowedNavPaths = profile.role ? getAllowedNavPaths(profile.role) : [];
  const now = new Date();
  const vehiclesOnTripsSeries = dailySeries(now, 14, (start, end) => new Set(uniqueTrips
    .filter((trip) => inRange(tripCreatedAt(trip), start, end))
    .map((trip) => trip.vehicleId || trip.vehicle_id)
    .filter(Boolean)).size);
  const tripsPerDaySeries = dailySeries(now, 14, (start, end) => uniqueTrips.filter((trip) => inRange(tripCreatedAt(trip), start, end)).length);
  const bookingsPerDaySeries = dailySeries(now, 14, (start, end) => snapshot.bookings.filter((booking) => inRange(parseDate(booking.created_at), start, end)).length);
  const onTimeSeries = carryForward(dailySeries(now, 14, (start, end) => {
    const outcomes = completedTripRows
      .filter((trip) => inRange(tripCompletionTime(trip), start, end))
      .map(onTimeOutcome)
      .filter((value): value is boolean => value !== null);
    return outcomes.length ? Math.round((outcomes.filter(Boolean).length / outcomes.length) * 1000) / 10 : null;
  }));
  const fleetStatus = calculateFleetStatus(uniqueVehicles);

  if (dashboardFullscreen) {
    return (
      <div className="fixed inset-0 z-[9998] bg-background text-on-background">
        <MapSection
          trips={snapshot.trips}
          vehicles={snapshot.vehicles}
          bookings={snapshot.bookings}
          parcels={parcels}
          drivers={snapshot.drivers}
          routePlans={snapshot.routePlans ?? []}
          isFullscreen={true}
          onToggleFullscreen={() => setDashboardFullscreen(false)}
        />
      </div>
    );
  }

  const featuredKPIs: Array<{ id: string; label: string; icon: string; badge: string; badgeClass: string; value: string | number; series: number[]; change: string | null; caption: string }> = [
    { id: "active-vehicles", label: "Active Vehicles", icon: "directions_car", badge: "Live", badgeClass: "bg-pink-50 text-pink-700", value: activeVehiclesCount, series: vehiclesOnTripsSeries, change: weekOverWeek(vehiclesOnTripsSeries), caption: "vehicles on trips / day" },
    { id: "in-transit", label: "Active Trips", icon: "alt_route", badge: "Active", badgeClass: "bg-emerald-50 text-emerald-700", value: activeTripsCount, series: tripsPerDaySeries, change: weekOverWeek(tripsPerDaySeries), caption: "trips created / day" },
    { id: "pending-bookings", label: "Pending Bookings", icon: "book_online", badge: "Queue", badgeClass: "bg-amber-50 text-amber-700", value: pendingBookingsCount, series: bookingsPerDaySeries, change: weekOverWeek(bookingsPerDaySeries), caption: "bookings created / day" },
    { id: "on-time-rate", label: "On-Time Rate", icon: "trending_up", badge: "KPI", badgeClass: "bg-pink-50 text-pink-700", value: onTimeRate != null ? `${onTimeRate}%` : "No data", series: onTimeSeries, change: weekOverWeek(onTimeSeries, true), caption: "on-time % / day" },
  ];

  const compactKPIs: Array<{ id: string; label: string; icon: string; badge: string; badgeClass: string; value: string | number }> = [
    { id: "total-vehicles", label: "Total Vehicles", icon: "local_shipping", badge: "Fleet", badgeClass: "bg-pink-50 text-pink-700", value: totalVehiclesCount },
    { id: "completed-trips", label: "Completed Trips", icon: "done", badge: "Done", badgeClass: "bg-emerald-50 text-emerald-700", value: completedTrips },
    { id: "total-bookings", label: "Total Bookings", icon: "receipt_long", badge: "Orders", badgeClass: "bg-pink-50 text-pink-700", value: totalBookingsCount },
    { id: "total-drivers", label: "Drivers Assigned", icon: "badge", badge: "Staff", badgeClass: "bg-pink-50 text-pink-700", value: totalDriversCount },
    { id: "fleet-efficiency", label: "Fleet Efficiency", icon: "bolt", badge: "Avg", badgeClass: "bg-emerald-50 text-emerald-700", value: efficiencyFuelLiters > 0 ? `${fleetEfficiency} km/L` : fleetEfficiency },
    { id: "system-health", label: "System Health", icon: "health_and_safety", badge: "100%", badgeClass: "bg-emerald-50 text-emerald-700", value: systemHealth },
    { id: "total-parcels", label: "Total Parcels", icon: "local_shipping", badge: "Count", badgeClass: "bg-blue-50 text-blue-700", value: totalParcelsCount },
    { id: "total-fuel", label: "Reported Fuel Volume", icon: "local_gas_station", badge: "Fuel log", badgeClass: "bg-amber-50 text-amber-700", value: `${totalFuelReported.toFixed(1)}L` },
    { id: "operating-cost", label: "Operating Cost", icon: "account_balance", badge: "Cost", badgeClass: "bg-red-50 text-red-700", value: `₱${totalOperatingCost.toFixed(2)}` },
    { id: "driver-allowance", label: "Driver Allowance", icon: "payments", badge: "Driver", badgeClass: "bg-violet-50 text-violet-700", value: `₱${driverAllowanceCost.toFixed(2)}` },
    { id: "mobile-data", label: "Data & Internet", icon: "wifi", badge: "Data", badgeClass: "bg-sky-50 text-sky-700", value: `₱${mobileDataCost.toFixed(2)}` },
  ];

  const heroActions = [
    { label: "Plan Route", href: "/vrds/route-planning", icon: "route", primary: true },
    { label: "Assign Booking", href: "/vrds/bookings", icon: "assignment", primary: false },
    { label: "View Alerts", href: "/alerts", icon: "notifications", primary: false },
  ].filter((action) => allowedNavPaths.includes(action.href));

  return (
    <div className="min-h-screen flex flex-col text-on-background font-sans w-full">
      <GlobalNavbar />

      <main className="ftm-dash-v1 flex-1 w-full space-y-5 px-4 pb-8 pt-1 sm:px-6 lg:px-8">
        {sourceErrors.length > 0 && <div role="status" className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold">Some dashboard sources could not be loaded</p><ul className="mt-1 list-inside list-disc">{sourceErrors.map((sourceError) => <li key={sourceError}>{sourceError}</li>)}</ul><p className="mt-1 text-[10px]">Available trip and vehicle data is still shown; affected module metrics may be incomplete.</p></div><button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-[10px] font-bold hover:bg-amber-100">Retry</button></div>}

        {/* Hero */}
        <section id="ftm-dashboard-top" className="ftm-hero relative flex scroll-mt-24 flex-col gap-6 overflow-hidden rounded-[24px] p-7 text-white xl:flex-row xl:items-center xl:justify-between">
          <svg aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-full opacity-20" width="420" viewBox="0 0 420 180" fill="none">
            <circle cx="330" cy="40" r="120" stroke="#fff" strokeWidth="1.5" />
            <circle cx="330" cy="40" r="80" stroke="#fff" strokeWidth="1.5" />
            <circle cx="330" cy="40" r="40" stroke="#fff" strokeWidth="1.5" />
          </svg>
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-bold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Live Telemetry
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Welcome back, {firstNameOf(profile.name)} 👋</h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">Logistics Command Center — real-time dispatch overview, vehicle tracking, cost analysis and fleet optimization at a glance.</p>
          </div>
          {heroActions.length > 0 && (
            <div className="relative flex shrink-0 flex-wrap gap-3">
              {heroActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={action.primary
                    ? "flex h-11 items-center gap-2 rounded-full bg-[#ffffff] px-5 text-sm font-bold text-[#b80049] hover:bg-pink-50"
                    : "flex h-11 items-center gap-2 rounded-full border border-white/30 bg-white/15 px-5 text-sm font-bold text-white hover:bg-white/25"}
                >
                  <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Featured KPIs (click a card to hide/show its value; Ctrl+S shows all, Ctrl+H hides all) */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featuredKPIs.map((kpi) => (
            <button key={kpi.id} type="button" onClick={() => toggleKPIVisibility(kpi.id)} className="ftm-card p-5 text-left transition-colors hover:border-pink-300">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0f6] text-[#b80049]">
                  <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
                </span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${kpi.badgeClass}`}>{kpi.badge}</span>
              </div>
              <div className="mt-4 text-sm font-semibold text-slate-500">{kpi.label}</div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-3xl font-extrabold tracking-tight text-slate-900">{renderKPIValue(kpi.id, kpi.value)}{renderKPITrend(kpi.id)}</div>
                  <div className="mt-0.5 text-xs font-bold">
                    {kpi.change
                      ? <span className={kpi.change.startsWith("−") ? "text-red-500" : "text-emerald-600"}>{kpi.change}</span>
                      : <span className="text-slate-400">—</span>}
                    <span className="ml-1 font-medium text-slate-500">vs last wk</span>
                  </div>
                </div>
                <Sparkline values={kpi.series} title={`Last 8 days: ${kpi.caption}`} />
              </div>
            </button>
          ))}
        </section>

        {/* Remaining KPIs */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">More fleet KPIs</h2>
            <span className="text-xs text-slate-500">Click a card to hide/show its value</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {compactKPIs.map((kpi) => (
              <button key={kpi.id} type="button" onClick={() => toggleKPIVisibility(kpi.id)} className="ftm-card ftm-card-sm p-3.5 text-left transition-colors hover:border-pink-300">
                <div className="flex items-center justify-between text-[#b80049]">
                  <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${kpi.badgeClass}`}>{kpi.badge}</span>
                </div>
                <div className="mt-2 text-[17px] font-extrabold leading-tight text-slate-900">{renderKPIValue(kpi.id, kpi.value)}{renderKPITrend(kpi.id)}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{kpi.label}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Live Fleet Map + Fleet Utilization + Fuel Consumption */}
        <section id="ftm-live-map" className="grid scroll-mt-24 grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="ftm-card p-5 xl:col-span-7">
            <MapSection 
              trips={snapshot.trips}
              vehicles={snapshot.vehicles}
              bookings={snapshot.bookings}
              parcels={parcels}
              drivers={snapshot.drivers}
              routePlans={snapshot.routePlans ?? []}
              isFullscreen={false}
              onToggleFullscreen={() => setDashboardFullscreen(true)}
            />
          </div>

          <div className="flex flex-col gap-5 xl:col-span-5">
            <div className="ftm-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Fleet Utilization</h3>
                  <p className="text-xs text-slate-500">Status across categories</p>
                </div>
                <span className="rounded-xl bg-pink-50 p-2 text-[#b80049]">
                  <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                </span>
              </div>
              {fleetStatus.total > 0 ? (
                <div className="mt-3 flex items-center gap-6">
                  <div className="relative shrink-0">
                    <Donut parts={fleetStatus.parts} size={132} thickness={18} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-2xl font-extrabold text-slate-900">{fleetStatus.utilized}%</div>
                      <div className="text-[10px] font-semibold text-slate-500">utilized</div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 text-sm">
                    {fleetStatus.parts.map((part) => (
                      <div key={part.label} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: part.color }} />
                        <span className="font-semibold text-slate-700">{part.label}</span>
                        <span className="ml-auto font-extrabold text-slate-900">{part.count} · {part.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">No vehicle status data available yet.</div>
              )}
              {fleetUtilizationData.length > 0 && (
                <div className="mt-4 h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fleetUtilizationData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="category" tick={{ fontSize: 9, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" height={30} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #fbcfe8" }} />
                      <Bar dataKey="active" name="Active" fill="#b80049" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="idle" name="Idle" fill="#f472b6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="ftm-card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Fuel Consumption</h3>
                  <p className="text-xs text-slate-500">Weekly volume (L)</p>
                </div>
                <span className="p-2 rounded-xl bg-pink-50 text-[#b80049]">
                  <span className="material-symbols-outlined text-[18px]">local_gas_station</span>
                </span>
              </div>
              <div className="h-[210px] w-full">
                {fuelConsumptionData.length === 0 ? <div className="grid h-full place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-[11px] text-slate-500">No actual consumed-fuel measurements are available for this period. Refueling and purchase liters are excluded.</div> :
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fuelConsumptionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#b80049" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#b80049" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #fbcfe8" }} />
                    <Area type="monotone" dataKey="consumption" stroke="#b80049" strokeWidth={2} fillOpacity={1} fill="url(#colorFuel)" />
                  </AreaChart>
                </ResponsiveContainer>
                }
              </div>
            </div>
          </div>
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="ftm-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Warehouse Throughput</h3>
                <p className="text-xs text-slate-500">Inbound vs outbound</p>
              </div>
              <span className="p-2 rounded-xl bg-pink-50 text-[#b80049]">
                <span className="material-symbols-outlined text-[18px]">warehouse</span>
              </span>
            </div>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={warehouseThroughputData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #fbcfe8" }} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="inbound" name="Inbound" fill="#b80049" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outbound" name="Outbound" fill="#f472b6" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ftm-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Driver Performance</h3>
                <p className="text-xs text-slate-500">Completed, active, and delayed trips</p>
              </div>
              <span className="p-2 rounded-xl bg-pink-50 text-[#b80049]">
                <span className="material-symbols-outlined text-[18px]">badge</span>
              </span>
            </div>
            <div className="h-[180px] w-full">
              {driverPerformanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={driverPerformanceData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis dataKey="driver" type="category" tick={{ fontSize: 9, fill: "#64748b" }} width={80} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #fbcfe8" }} />
                    <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="active" name="Active" fill="#ec2188" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="delayed" name="Delayed" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-xs text-slate-500">
                  No driver trip data available yet.
                </div>
              )}
            </div>
          </div>

          <div className="ftm-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delivery Performance</h3>
                <p className="text-xs text-slate-500">On-time vs delayed %</p>
              </div>
              <span className="p-2 rounded-xl bg-pink-50 text-[#b80049]">
                <span className="material-symbols-outlined text-[18px]">trending_up</span>
              </span>
            </div>
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deliveryPerformanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #fbcfe8" }} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="onTime" name="On-Time %" fill="#ec2188" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delayed" name="Delayed %" fill="#fda4af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ftm-card p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Fleet Cost Breakdown</h3>
                <p className="text-xs text-slate-500">OpEx distribution</p>
              </div>
              <span className="p-2 rounded-xl bg-pink-50 text-[#b80049]">
                <span className="material-symbols-outlined text-[18px]">pie_chart</span>
              </span>
            </div>
            <div className="h-[180px] w-full flex items-center justify-center">
              {costBreakdownData.length > 0 ? <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {costBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #fbcfe8" }}
                    formatter={(value, _name, item) => [
                      `${value ?? 0}% (${Number(item?.payload?.amount || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })})`,
                      "Share",
                    ]}
                  />
                  <Legend iconSize={7} wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-center text-xs text-slate-500">No cost data available.</div>}
            </div>
          </div>
        </section>

        {/* Logistics widgets row */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="ftm-card p-5">
            <SpecializedLogistics 
              trips={snapshot.trips} 
              vehicles={snapshot.vehicles} 
              bookings={snapshot.bookings} 
            />
          </div>
          <div className="ftm-card p-5">
            <PerformanceMetrics 
              trips={snapshot.trips} 
              vehicles={snapshot.vehicles} 
            />
          </div>
          <div className="ftm-card p-5">
            <ResourceData 
              bookings={snapshot.bookings} 
              trips={snapshot.trips}
            />
          </div>
          <div className="ftm-card p-5">
            <SensorHub 
              vehicles={snapshot.vehicles}
              trips={snapshot.trips}
            />
          </div>
        </section>

        <section id="ftm-mission-logs" className="ftm-card scroll-mt-24 p-5">
          <MissionLogs trips={snapshot.trips} />
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}
