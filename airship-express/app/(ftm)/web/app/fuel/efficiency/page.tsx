"use client";

import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

import { useState, useEffect, useMemo } from "react";
import { useParcelStore } from "../../lib/parcelStore";
import { getCostEntries, getDrivers, getFuelLogs, getVehicles } from "../../lib/api";
import { SERVICE_AREA_CITIES, inferCityFromCoordinates } from "../../lib/serviceAreas";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";
const MS_DAY = 24 * 60 * 60 * 1000;

type VrdsRecord = {
  id: string;
  date: Date;
  city: string;
  status: string;
  courier?: string;
  delivered: number;
  total: number;
};

function getRecordDate(value: string | undefined | null) {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function inferCityFromAddress(address: string, lat?: number | null, lng?: number | null) {
  if (typeof lat === "number" && typeof lng === "number") {
    const city = inferCityFromCoordinates(lat, lng);
    if (city) return city;
  }

  const head = (address || "").toLowerCase();
  for (const city of SERVICE_AREA_CITIES) {
    if (head.includes(city.toLowerCase())) return city;
  }

  return "Unknown";
}

function buildVrdsRecords(parcels: any[], bookings: any[]) {
  const records: VrdsRecord[] = [];
  const parcelBucket = new Map<string, VrdsRecord>();

  for (const parcel of parcels) {
    const city = inferCityFromAddress(parcel.destinationAddress || "", parcel.destLat, parcel.destLng);
    const date = getRecordDate(parcel.receivedAt || "");
    const key = `${city}-${date.toISOString().slice(0, 10)}`;
    const entry = parcelBucket.get(key) ?? {
      id: key,
      date,
      city,
      status: String(parcel.status || "RECEIVED"),
      courier: parcel.courier || "Unassigned",
      delivered: 0,
      total: 0,
    };

    entry.total += 1;
    if (String(parcel.status || "").toUpperCase() === "DELIVERED") entry.delivered += 1;
    parcelBucket.set(key, entry);
  }

  for (const booking of bookings) {
    const city = inferCityFromAddress(booking.routeLabel || booking.route_label || "", booking.pickupLatitude, booking.pickupLongitude);
    const date = getRecordDate(booking.createdAt || booking.created_at || booking.updatedAt || booking.updated_at);
    const key = `${city}-${date.toISOString().slice(0, 10)}-booking`;
    const entry = parcelBucket.get(key) ?? {
      id: key,
      date,
      city,
      status: String(booking.status || "PENDING"),
      courier: booking.courier || "Unassigned",
      delivered: 0,
      total: 0,
    };
    entry.total += 1;
    if (String(booking.status || "").toUpperCase() === "DISPATCHED") entry.delivered += 1;
    parcelBucket.set(key, entry);
  }

  for (const entry of parcelBucket.values()) {
    records.push(entry);
  }

  return records.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getRangeStart(range: "Last 7 Days" | "Last 30 Days" | "This Month") {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (range === "Last 7 Days") start.setDate(start.getDate() - 6);
  else if (range === "Last 30 Days") start.setDate(start.getDate() - 29);
  else start.setDate(1);
  return start.getTime();
}

function getVehicleClass(vehicle: any) {
  const type = String(vehicle?.vehicleType || vehicle?.vehicle_type || vehicle?.type || "").toLowerCase();
  if (/semi|hauler|rig|heavy/.test(type)) return "Heavy Hauler Semi";
  if (/box|truck/.test(type)) return "Class 5 Box Trucks";
  if (/van|pickup|sedan|car/.test(type)) return "Class 3 Delivery Vans";
  return "Unknown Class";
}

function getRouteText(record: any) {
  return [
    record?.route,
    record?.routeLabel,
    record?.pickup_location,
    record?.dropoff_location,
    record?.pickupLocation,
    record?.dropoffLocation,
    record?.destination,
    record?.destination_zone,
  ].filter(Boolean).join(" ").toLowerCase();
}

function isFuelCategory(value: unknown) {
  return /fuel|energy/i.test(String(value ?? ""));
}

function getLogTimestamp(record: any) {
  return getRecordDate(record?.loggedAt ?? record?.logged_at ?? record?.entryDate ?? record?.entry_date ?? record?.createdAt ?? record?.created_at).getTime();
}

function mergeFuelRecords(logs: any[], costEntries: any[]) {
  const fuelCosts = costEntries.filter((entry: any) => isFuelCategory(entry.category));
  const remainingLogs = [...logs];
  const merged = logs.map((log: any) => ({ ...log }));

  for (const entry of fuelCosts) {
    const entryVehicleId = String(entry.vehicleId ?? entry.vehicle_id ?? "");
    const entryTripId = String(entry.tripId ?? entry.trip_id ?? "");
    const entryDate = getLogTimestamp(entry);
    const matchIndex = remainingLogs.findIndex((log: any) => {
      const sameId = entry.id != null && String(log.id) === String(entry.id);
      const sameTrip = entryTripId && String(log.tripId ?? log.trip_id ?? "") === entryTripId;
      const sameVehicleAndDay = entryVehicleId
        && String(log.vehicleId ?? log.vehicle_id ?? "") === entryVehicleId
        && Math.abs(getLogTimestamp(log) - entryDate) < 24 * 60 * 60 * 1000;
      return sameId || sameTrip || sameVehicleAndDay;
    });
    const receiptAmount = Number(entry.amount ?? entry.cost);

    if (matchIndex >= 0) {
      const log = merged[matchIndex];
      merged[matchIndex] = {
        ...log,
        amount: Number.isFinite(receiptAmount) ? receiptAmount : log.amount,
        cost: Number.isFinite(receiptAmount) ? receiptAmount : log.cost,
        receipt_image: entry.receipt_image ?? entry.receiptImage ?? log.receipt_image,
        categoryCost: entry.categoryCost ?? log.categoryCost,
      };
      remainingLogs.splice(matchIndex, 1);
      continue;
    }

    merged.push({
      id: entry.id,
      vehicleId: entryVehicleId || null,
      tripId: entryTripId || null,
      liters: entry.categoryCost?.liters != null ? Number(entry.categoryCost.liters) : null,
      odometerReading: entry.categoryCost?.odometer_reading != null ? Number(entry.categoryCost.odometer_reading) : null,
      distance: 0,
      amount: Number.isFinite(receiptAmount) ? receiptAmount : null,
      cost: Number.isFinite(receiptAmount) ? receiptAmount : null,
      receipt_image: entry.receipt_image ?? entry.receiptImage ?? null,
      loggedAt: entry.entryDate ?? entry.entry_date ?? entry.recorded_at ?? entry.created_at ?? null,
    });
  }

  return merged;
}

export default function FuelEfficiencyPage() {
  const [selectedMode, setSelectedMode] = useState<"Daily" | "Weekly">("Daily");
  const [selectedRange, setSelectedRange] = useState<"Last 7 Days" | "Last 30 Days" | "This Month">("Last 30 Days");
  const [showFleetFilter, setShowFleetFilter] = useState(false);
  const [smartRoutingApplied, setSmartRoutingApplied] = useState(false);
  const [leaderboardView, setLeaderboardView] = useState<"Drivers" | "Vehicles">("Drivers");
  const [selectedVehicleClass, setSelectedVehicleClass] = useState<string>("All Classes");
  const [selectedRegion, setSelectedRegion] = useState("All Regions");
  const [selectedRouteStatus, setSelectedRouteStatus] = useState("All States");
  const [showMetricValues, setShowMetricValues] = useState(false);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [fuelDrivers, setFuelDrivers] = useState<any[]>([]);
  const [fuelVehicles, setFuelVehicles] = useState<any[]>([]);

  const handleMetricToggle = () => setShowMetricValues((current) => !current);

  useEffect(() => {
    const handleMetricVisibilityShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        setShowMetricValues(true);
      }
      if (key === "h") {
        event.preventDefault();
        setShowMetricValues(false);
      }
    };

    window.addEventListener("keydown", handleMetricVisibilityShortcut);
    return () => window.removeEventListener("keydown", handleMetricVisibilityShortcut);
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([getFuelLogs(), getCostEntries(), getDrivers(), getVehicles()]).then(([logs, costEntries, drivers, vehicles]) => {
      if (mounted) {
        setFuelLogs(mergeFuelRecords(
          Array.isArray(logs) ? logs : [],
          Array.isArray(costEntries) ? costEntries : [],
        ));
        setFuelDrivers(Array.isArray(drivers) ? drivers : []);
        setFuelVehicles(Array.isArray(vehicles) ? vehicles : []);
      }
    }).catch(() => {
      if (mounted) {
        setFuelLogs([]);
        setFuelDrivers([]);
        setFuelVehicles([]);
      }
    });
    return () => { mounted = false; };
  }, []);

  const { parcels: vrdsParcels, bookings: vrdsBookings, drivers: vrdsDrivers, vehicles: vrdsVehicles } = useParcelStore();
  const rangeStart = getRangeStart(selectedRange);
  const vrdsRecords = useMemo(
    () => buildVrdsRecords(vrdsParcels, vrdsBookings),
    [vrdsParcels, vrdsBookings]
  );

  const vehiclesById = useMemo(
    () => new Map([...(vrdsVehicles || []), ...(fuelVehicles || [])].map((vehicle: any) => [String(vehicle.id), vehicle])),
    [vrdsVehicles, fuelVehicles]
  );

  const driversById = useMemo(
    () => new Map([...(vrdsDrivers || []), ...(fuelDrivers || [])].map((driver: any) => [String(driver.id), driver])),
    [vrdsDrivers, fuelDrivers]
  );

  const rangeRecords = useMemo(
    () => vrdsRecords.filter((record) => record.date.getTime() >= rangeStart),
    [vrdsRecords, rangeStart]
  );

  const rangeLogs = useMemo(() => {
    const next = vrdsParcels.filter((parcel: any) => {
      const parcelDate = getRecordDate(parcel.receivedAt || "");
      if (parcelDate.getTime() < rangeStart) return false;
      if (selectedVehicleClass !== "All Classes") {
        const vehicle = vehiclesById.get(String(parcel.vehicleId || parcel.vehicle_id || ""));
        if (getVehicleClass(vehicle) !== selectedVehicleClass) return false;
      }
      if (selectedRegion !== "All Regions") {
        const city = inferCityFromAddress(parcel.destinationAddress || "", parcel.destLat, parcel.destLng);
        const regionText = selectedRegion === "Zone A - Urban Core" ? ["Manila", "Makati", "Pasig", "Taguig", "Quezon City"] : selectedRegion === "Zone B - West Suburbs" ? ["Parañaque", "Pasay", "Mandaluyong", "San Juan"] : ["Caloocan", "Valenzuela", "Quezon City", "Marikina"];
        if (!regionText.includes(city)) return false;
      }
      return true;
    });
    return next;
  }, [vrdsParcels, rangeStart, selectedVehicleClass, selectedRegion, vehiclesById]);

  const rangeFuelLogs = useMemo(() => fuelLogs.filter((log: any) => {
    const timestamp = getRecordDate(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at).getTime();
    if (timestamp < rangeStart) return false;
    if (selectedVehicleClass !== "All Classes") {
      const vehicle = vehiclesById.get(String(log.vehicleId ?? log.vehicle_id ?? ""));
      if (getVehicleClass(vehicle) !== selectedVehicleClass) return false;
    }
    return true;
  }), [fuelLogs, rangeStart, selectedVehicleClass, vehiclesById]);

  const efficiencyTrendDataView = (() => {
    const days = selectedMode === "Daily" ? (selectedRange === "Last 7 Days" ? 7 : 10) : 5;
    const results: { date: string; efficiency: number; throughput: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      if (selectedMode === "Daily") d.setDate(now.getDate() - i);
      else d.setDate(now.getDate() - i * 7);
      results.push({ date: d.toISOString().slice(0, 10), efficiency: 0, throughput: 0 });
    }

    if (!rangeFuelLogs.length) {
      return results.map((item) => ({
        ...item,
        date: new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      }));
    }

    for (const result of results) {
      const bucketDate = new Date(result.date);
      const bucketLogs = rangeFuelLogs.filter((log: any) => {
        const parcelDate = getRecordDate(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at);
        return selectedMode === "Daily"
          ? parcelDate.toDateString() === bucketDate.toDateString()
          : Math.floor((bucketDate.getTime() - parcelDate.getTime()) / (7 * MS_DAY)) === 0;
      });
      const liters = bucketLogs.reduce((sum: number, log: any) => sum + Number(log.liters ?? log.volume ?? 0), 0);
      const distance = bucketLogs.reduce((sum: number, log: any) => sum + Number(log.distance ?? log.distance_km ?? 0), 0);
      result.throughput = bucketLogs.length;
      result.efficiency = liters > 0 ? Number((distance / liters).toFixed(1)) : 0;
    }

    return results.map((item) => ({
      ...item,
      date: new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));
  })();

  const hourlyLoadDataView = (() => {
    const slots = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
    const result = slots.map((s) => ({ hour: s, load: 0 }));
    if (!rangeLogs.length) return result;

    for (const parcel of rangeLogs) {
      const parcelDate = getRecordDate(parcel.receivedAt || "");
      const h = parcelDate.getHours();
      const idx = Math.floor((h - 6) / 3);
      const place = Math.max(0, Math.min(result.length - 1, idx));
      result[place].load += 1;
    }

    const maxLoad = Math.max(...result.map((r) => r.load), 1);
    return result.map((r) => ({ hour: r.hour, load: Math.round((r.load / maxLoad) * 100) }));
  })();

  function percentChange(current: number, previous: number) {
    if (!isFinite(previous) || previous === 0) return "—";
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }

  const avgEfficiency = (() => {
    const liters = rangeFuelLogs.reduce((sum: number, log: any) => sum + Number(log.liters ?? log.volume ?? 0), 0);
    const distance = rangeFuelLogs.reduce((sum: number, log: any) => sum + Number(log.distance ?? log.distance_km ?? 0), 0);
    if (liters <= 0 || distance <= 0) return "—";
    const value = (distance / liters).toFixed(1);
    return showMetricValues ? value : "••••";
  })();

  const now = Date.now();
  const windowDays = 30;
  const periodEnd = now;
  const periodStart = now - windowDays * MS_DAY;
  const prevPeriodStart = periodStart - windowDays * MS_DAY;
  const prevPeriodEnd = periodStart - 1;

  const currentPeriodLogs = fuelLogs.filter((log: any) => {
    const ts = getRecordDate(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at).getTime();
    return ts >= periodStart && ts <= periodEnd;
  });

  const previousPeriodLogs = fuelLogs.filter((log: any) => {
    const ts = getRecordDate(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at).getTime();
    return ts >= prevPeriodStart && ts <= prevPeriodEnd;
  });

  const calculateEfficiency = (logs: any[]) => {
    const liters = logs.reduce((sum: number, log: any) => sum + Number(log.liters ?? log.volume ?? 0), 0);
    const distance = logs.reduce((sum: number, log: any) => sum + Number(log.distance ?? log.distance_km ?? 0), 0);
    return liters > 0 ? distance / liters : 0;
  };

  const currentEfficiency = calculateEfficiency(currentPeriodLogs);
  const previousEfficiency = calculateEfficiency(previousPeriodLogs);
  const efficiencyChange = (() => {
    return previousEfficiency > 0 ? percentChange(currentEfficiency, previousEfficiency) : "—";
  })();

  const currentLiters = rangeFuelLogs.reduce(
    (sum: number, log: any) => sum + Number(log.liters ?? log.volume ?? 0),
    0,
  );

  const totalFuelYTD = (() => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const total = fuelLogs.filter((log: any) => {
      const ts = getRecordDate(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at).getTime();
      return ts >= yearStart && ts <= Date.now();
    }).reduce((sum: number, log: any) => sum + Number(log.liters ?? log.volume ?? 0), 0);
    return `${total.toLocaleString()} L`;
  })();

  const regenRoutesView = (() => {
    const totalsByCity: Record<string, number> = {};
    for (const parcel of rangeLogs) {
      const city = inferCityFromAddress(parcel.destinationAddress || "", parcel.destLat, parcel.destLng);
      totalsByCity[city] = (totalsByCity[city] || 0) + 1;
    }

    const entries = Object.entries(totalsByCity).map(([label, value]) => ({ label, value }));
    const total = entries.reduce((sum, entry) => sum + entry.value, 0) || 1;
    return entries.slice(0, 3).map((entry, index) => ({
      label: entry.label,
      pct: Math.round((entry.value / total) * 100),
      opacity: index === 0 ? "" : index === 1 ? "opacity-80" : "opacity-50",
    }));
  })();

  const numRoutes = (() => {
    const active = vrdsBookings.filter((booking: any) => {
      const ts = getRecordDate(booking.createdAt || booking.created_at || booking.updatedAt || booking.updated_at).getTime();
      return ts >= rangeStart;
    });
    return active.length || 0;
  })();

  const leaderboardItems = (() => {
    const byKey: Record<string, { id: string; name: string; liters: number; distance: number; records: number }> = {};

    for (const log of rangeFuelLogs) {
      const liters = Number(log.liters ?? log.volume ?? 0);
      const distance = Number(log.distance ?? log.distance_km ?? 0);
      if (liters <= 0 || distance <= 0) continue;

      const key = leaderboardView === "Vehicles"
        ? String(log.vehicleId ?? log.vehicle_id ?? "unknown")
        : String(log.driverId ?? log.driver_id ?? "unknown");
      const related = leaderboardView === "Vehicles"
        ? vehiclesById.get(key)
        : driversById.get(key);
      const name = leaderboardView === "Vehicles"
        ? String(related?.plateNumber ?? related?.plate ?? related?.name ?? key)
        : String(related?.name ?? related?.full_name ?? related?.fullName ?? key);
      byKey[key] = byKey[key] || { id: key, name, liters: 0, distance: 0, records: 0 };
      byKey[key].liters += liters;
      byKey[key].distance += distance;
      byKey[key].records += 1;
    }

    const arr = Object.values(byKey)
      .map((value) => ({
        ...value,
        efficiency: Number((value.distance / value.liters).toFixed(1)),
      }))
      .sort((a, b) => b.efficiency - a.efficiency);

    return arr.slice(0, 5).map((entry, idx) => ({
      rank: idx + 1,
      name: entry.name,
      route: `${entry.records} fuel records`,
      value: `${entry.efficiency}`,
    }));
  })();

  const measuredFuelCoverage = (() => {
    if (!rangeFuelLogs.length) return null;
    const measured = rangeFuelLogs.filter((log: any) => (
      Number(log.liters ?? log.volume ?? 0) > 0
      && Number(log.distance ?? log.distance_km ?? 0) > 0
    )).length;
    return Math.round((measured / rangeFuelLogs.length) * 100);
  })();

  const classEfficiencyChart = (() => {
    const stats = new Map<string, { liters: number; distance: number; label: string }>();

    for (const log of rangeFuelLogs) {
      const vehicle = vehiclesById.get(String(log.vehicleId ?? log.vehicle_id ?? ""));
      const label = getVehicleClass(vehicle);
      const current = stats.get(label) ?? { liters: 0, distance: 0, label };
      current.liters += Number(log.liters ?? log.volume ?? 0);
      current.distance += Number(log.distance ?? log.distance_km ?? 0);
      stats.set(label, current);
    }

    return Array.from(stats.values())
      .map((entry) => ({
        label: entry.label,
        efficiency: entry.liters > 0 ? Number((entry.distance / entry.liters).toFixed(1)) : 0,
      }))
      .filter((entry) => entry.efficiency > 0)
      .sort((a, b) => b.efficiency - a.efficiency)
      .slice(0, 4);
  })();

  return (
    <div className="flex flex-col min-h-screen bg-[#fff7fc] text-[#141d23]">
      <GlobalNavbar />
      
      <main className="flex-grow w-full max-w-[1700px] mx-auto px-6 md:px-12 py-8 flex flex-col gap-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-[#ec2188]/15 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#b80049]/10 text-[#b80049] uppercase tracking-wider">
                Courier Route Telemetry
              </span>
              <span className="text-xs text-[#5b6b79]">• Live Monitoring</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#141d23] tracking-tight">Courier Route Efficiency & Fuel</h1>
            <p className="text-sm md:text-base text-[#5b6b79] mt-1.5 max-w-2xl">
              Advanced analytics tracking delivery route efficiency, dispatch fuel use, and real-time courier asset performance across active Airship Express operations.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative">
              <select
                value={selectedRange}
                onChange={(event) => setSelectedRange(event.target.value as typeof selectedRange)}
                aria-label="Fuel analysis date range"
                className="flex appearance-none items-center gap-2 bg-white border border-[#ec2188]/20 px-4 py-2.5 pr-10 rounded-xl text-sm font-medium text-[#141d23] hover:border-[#b80049] hover:bg-[#fff7fc] transition-all shadow-xs"
              >
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>This Month</option>
              </select>
            </div>

            <button
              onClick={() => setShowFleetFilter((prev) => !prev)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-xs border ${
                showFleetFilter 
                  ? "bg-[#b80049] text-white border-[#b80049]" 
                  : "bg-white border-[#ec2188]/20 text-[#141d23] hover:border-[#b80049] hover:bg-[#fff7fc]"
              }`}
            >
              <Icon name="tune" className={`text-[18px] ${showFleetFilter ? "text-white" : "text-[#b80049]"}`} />
              Filter Routes
            </button>
          </div>
        </div>

        {/* Expandable Fleet Filters */}
        {showFleetFilter && (
          <div className="rounded-2xl border border-[#b80049]/30 bg-white p-6 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#141d23] flex items-center gap-2">
                <Icon name="filter_alt" className="text-[#b80049]" /> Advanced Route Segmentation
              </h3>
              <button 
                onClick={() => setShowFleetFilter(false)}
                className="text-xs text-[#5b6b79] hover:text-[#b80049] font-medium"
              >
                Close Filters
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5b6b79] mb-1.5">Delivery Unit Class</label>
                <select 
                  value={selectedVehicleClass}
                  onChange={(e) => setSelectedVehicleClass(e.target.value)}
                  className="w-full bg-[#fff7fc] border border-[#ec2188]/20 rounded-xl px-3.5 py-2 text-sm text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049]/30"
                >
                  <option>All Classes</option>
                  <option>Class 3 Delivery Vans</option>
                  <option>Class 5 Box Trucks</option>
                  <option>Heavy Hauler Semi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5b6b79] mb-1.5">Service Region</label>
                <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="w-full bg-[#fff7fc] border border-[#ec2188]/20 rounded-xl px-3.5 py-2 text-sm text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049]/30">
                  <option value="All Regions">All Regions (Metro & Suburban)</option>
                  <option>Zone A - Urban Core</option>
                  <option>Zone B - West Suburbs</option>
                  <option>Zone C - Northern Corridor</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5b6b79] mb-1.5">Route Status</label>
                <select value={selectedRouteStatus} onChange={(event) => setSelectedRouteStatus(event.target.value)} className="w-full bg-[#fff7fc] border border-[#ec2188]/20 rounded-xl px-3.5 py-2 text-sm text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049]/30">
                  <option value="All States">All States</option>
                  <option>Active / En Route (&gt;20% SOC)</option>
                  <option>Charging Hub</option>
                  <option>Low Battery Flagged</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Main Bento Grid Layout (Full Width Usage) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Primary Trend Chart (8 Columns) */}
          <section className="lg:col-span-8 bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                    <Icon name="monitoring" className="text-xl" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-[#141d23]">Route Efficiency Trend</h2>
                    <p className="text-xs text-[#5b6b79]">Tracking fuel performance across active delivery routes</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleMetricToggle}
                  title={showMetricValues ? "Hide value" : "Show value"}
                  className="mt-4 flex items-center gap-3 text-left"
                >
                  <span className="text-4xl font-extrabold text-[#141d23] tracking-tight">
                    {avgEfficiency !== "—" ? (showMetricValues ? avgEfficiency : "••••") : "—"}
                  </span>
                  <span className="text-sm font-medium text-[#5b6b79]">Avg. km/L</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center border border-emerald-200">
                    <Icon name="trending_up" className="text-[14px] mr-1" />
                    {efficiencyChange}
                  </span>
                </button>
              </div>

              <div className="flex bg-[#fff7fc] p-1 rounded-xl border border-[#ec2188]/20">
                <button
                  onClick={() => setSelectedMode("Daily")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedMode === "Daily"
                      ? "bg-[#b80049] text-white shadow-xs"
                      : "text-[#5b6b79] hover:text-[#141d23]"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setSelectedMode("Weekly")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedMode === "Weekly"
                      ? "bg-[#b80049] text-white shadow-xs"
                      : "text-[#5b6b79] hover:text-[#141d23]"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            <div className="w-full h-[320px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={efficiencyTrendDataView} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b80049" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#b80049" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e2ec" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#5b6b79", fontSize: 12 }} axisLine={{ stroke: "#f0e2ec" }} tickLine={false} />
                  <YAxis domain={[0, "auto"]} tick={{ fill: "#5b6b79", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #ec2188/30", boxShadow: "0 10px 25px rgba(184,0,73,0.1)" }}
                    formatter={(value: any) => [`${value} km/L`, "Efficiency"]}
                  />
                  <Area type="monotone" dataKey="efficiency" stroke="#b80049" strokeWidth={3} fillOpacity={1} fill="url(#primaryGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Predictive Insight & Energy Banner (4 Columns) */}
          <section className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between flex-1">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="p-2.5 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                    <Icon name="lightbulb" className="text-xl" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#141d23]">Dispatch Insight</h3>
                    <p className="text-xs text-[#5b6b79]">Route load optimization recommendation</p>
                  </div>
                </div>
                <p className="text-sm text-[#5b6b79] leading-relaxed mb-6">
                  {rangeFuelLogs.length > 0 && avgEfficiency !== "—"
                    ? `Recorded fuel usage in the selected period averages ${avgEfficiency} km/L across ${rangeFuelLogs.length} refueling logs.`
                    : "There is not enough odometer or trip-distance data in the selected period to calculate a route efficiency recommendation."}
                </p>
                <div className="bg-[#fff7fc] p-4 rounded-xl border border-[#ec2188]/20 mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-[#5b6b79]">Fuel used in selected period</span>
                    <span className="text-sm font-bold text-[#b80049]">{Math.round(currentLiters || 0)}</span>
                  </div>
                  <div className="w-full bg-[#f0e2ec] rounded-full h-2 overflow-hidden">
                    <div className="bg-[#b80049] h-2 rounded-full transition-all duration-500" style={{ width: `${measuredFuelCoverage ?? 0}%` }} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSmartRoutingApplied(true)}
                className="w-full bg-[#fff7fc] hover:bg-[#b80049] hover:text-white text-[#141d23] text-sm font-semibold py-3 rounded-xl transition-all border border-[#ec2188]/30 flex justify-center items-center gap-2 group shadow-xs"
              >
                <span>Apply Dispatch Routing Profile</span>
                <Icon name="arrow_forward" className="text-sm transition-transform group-hover:translate-x-1" />
              </button>
              
              {smartRoutingApplied && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 animate-in fade-in duration-200">
                  ✓ Dispatch routing profile successfully deployed. Route predictions updated.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleMetricToggle}
              title={showMetricValues ? "Hide value" : "Show value"}
              className="bg-gradient-to-br from-[#b80049] to-[#ec2188] rounded-2xl p-6 shadow-md text-white flex flex-col justify-between relative overflow-hidden text-left"
            >
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex justify-between items-start relative z-10">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Fuel Used YTD</span>
                <span className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Icon name="eco" className="text-white text-lg" />
                </span>
              </div>
              <div className="mt-6 relative z-10">
                <div className="text-3xl font-black tracking-tight">{totalFuelYTD === "—" ? "—" : showMetricValues ? totalFuelYTD : "••••"}</div>
                <div className="text-xs opacity-85 mt-1">Total fuel used YTD</div>
              </div>
            </button>
          </section>

        </div>

        {/* Secondary Row: Live Peak Load Chart & Energy Recovery & Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* New Added Feature Chart: Hourly Thermal / HVAC Load Curve */}
          <section className="bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                    <Icon name="bolt" className="text-lg" />
                  </span>
                  <h3 className="text-base font-bold text-[#141d23]">Peak Route Activity</h3>
                </div>
                <span className="text-xs bg-[#fff7fc] text-[#5b6b79] px-2.5 py-1 rounded-full border border-[#ec2188]/20">{selectedRange}</span>
              </div>
              <p className="text-xs text-[#5b6b79] mb-4">Relative parcel activity by parcel receipt hour.</p>
            </div>

            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyLoadDataView} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e2ec" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: "#5b6b79", fontSize: 11 }} axisLine={{ stroke: "#f0e2ec" }} tickLine={false} />
                  <YAxis tick={{ fill: "#5b6b79", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: 10, border: "1px solid #ec2188/30" }}
                    formatter={(val: any) => [`${val}% Activity`, "Route activity"]}
                  />
                  <Bar dataKey="load" fill="#b80049" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Added chart: Vehicle Class Efficiency */}
          <section className="bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                  <Icon name="bar_chart" className="text-lg" />
                </span>
                <h3 className="text-base font-bold text-[#141d23]">Vehicle Class Efficiency</h3>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#fff7fc] text-[#5b6b79] px-2 py-1 rounded-full border border-[#ec2188]/20">km/L</span>
            </div>

            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classEfficiencyChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e2ec" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#5b6b79", fontSize: 10 }} axisLine={{ stroke: "#f0e2ec" }} tickLine={false} />
                  <YAxis tick={{ fill: "#5b6b79", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: 10, border: "1px solid #ec2188/30" }}
                    formatter={(value: any) => [`${value} km/L`, "Efficiency"]}
                  />
                  <Bar dataKey="efficiency" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Energy Recovery (Regen ROI) */}
          <section className="bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                  <Icon name="battery_charging_full" className="text-lg" />
                </span>
                <h3 className="text-base font-bold text-[#141d23]">Fuel Measurement Coverage</h3>
              </div>
              <span className="text-xs text-[#5b6b79] border border-[#ec2188]/20 px-3 py-1 rounded-full bg-[#fff7fc]">
                Selected Period
              </span>
            </div>

            <div className="flex gap-4 items-center my-auto py-2">
              <div className="relative w-28 h-28 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[#f0e2ec]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                  />
                  <path
                    className="text-[#b80049]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${measuredFuelCoverage ?? 0}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-[#141d23]">{measuredFuelCoverage === null ? "—" : `${measuredFuelCoverage}%`}</span>
                  <span className="text-[10px] font-semibold text-[#5b6b79] text-center uppercase tracking-wider">Measured</span>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                {regenRoutesView.map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs text-[#141d23] mb-1 font-medium">
                      <span className="truncate pr-2">{r.label}</span>
                      <span className="font-bold text-[#b80049]">{r.pct}%</span>
                    </div>
                    <div className="w-full bg-[#f0e2ec] rounded-full h-2 overflow-hidden">
                      <div
                        className={`bg-[#b80049] h-2 rounded-full ${r.opacity}`}
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Efficiency Leaderboard */}
          <section className="bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                    <Icon name="emoji_events" className="text-lg" />
                  </span>
                  <h3 className="text-base font-bold text-[#141d23]">Efficiency Leaderboard</h3>
                </div>
                <div className="flex bg-[#fff7fc] p-1 rounded-lg border border-[#ec2188]/20">
                  <button
                    onClick={() => setLeaderboardView("Drivers")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      leaderboardView === "Drivers"
                        ? "bg-[#b80049] text-white shadow-xs"
                        : "text-[#5b6b79] hover:text-[#141d23]"
                    }`}
                  >
                    Drivers
                  </button>
                  <button
                    onClick={() => setLeaderboardView("Vehicles")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      leaderboardView === "Vehicles"
                        ? "bg-[#b80049] text-white shadow-xs"
                        : "text-[#5b6b79] hover:text-[#141d23]"
                    }`}
                  >
                    Vehicles
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 mt-2">
                {leaderboardItems.length > 0 ? leaderboardItems.map((l) => (
                    <div
                      key={l.rank}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        l.rank === 1
                          ? "bg-[#fff7fc] border-[#ec2188]/30 shadow-xs"
                          : "bg-white hover:bg-[#fff7fc]/50 border-[#f0e2ec]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center font-bold ${
                            l.rank === 1 ? "bg-[#b80049] text-white shadow-xs" : "bg-[#f0e2ec] text-[#5b6b79]"
                          }`}
                        >
                          {l.rank}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#141d23]">{l.name}</div>
                          <div className="text-[11px] text-[#5b6b79]">{l.route}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-[#b80049]">{l.value}</div>
                        <div className="text-[10px] text-[#5b6b79]">km/L</div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-[#ec2188]/25 bg-[#fff7fc] px-4 py-8 text-center text-xs text-[#5b6b79]">
                      No measured fuel records for {leaderboardView.toLowerCase()} in the selected period.
                    </div>
                  )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#f0e2ec] flex items-center justify-between px-2 bg-[#fff7fc] rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#5b6b79] font-bold">{numRoutes}</span>
                <span className="text-xs font-bold text-[#141d23]">Your Route Average</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-[#141d23]">{avgEfficiency !== "—" ? (showMetricValues ? avgEfficiency : "••••") : "—"}</span>
                <span className="text-[10px] text-[#5b6b79] ml-1">km/L</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}

// regenRoutes and leaderboard are derived from live snapshot above

function Icon({
  name,
  className = "",
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return <span className={`material-symbols-outlined ${fill ? "icon-fill" : ""} ${className}`}>{name}</span>;
}