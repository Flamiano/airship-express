"use client";

import { useEffect, useState } from "react";
import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";
import { getTrips, getVehicles, getBookings, getDrivers, getFuelLogs, getCostEntries, getParcels, getRoutePlan } from "../lib/api";
import { useParcelStore } from "../lib/parcelStore";
import SpecializedLogistics from "./components/SpecializedLogistics";
import PerformanceMetrics from "./components/PerformanceMetrics";
import MissionLogs from "./components/MissionLogs";
import ResourceData from "./components/ResourceData";
import SensorHub from "./components/SensorHub";
import NewsAlerts from "./components/NewsAlerts";
import MapSection from "./components/MapSection";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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
  plateNumber?: string | null;
  vehicleType?: string | null;
  status?: string | null;
  driver_id?: string | null;
  driver?: string | null;
  driverName?: string | null;
  capacityKg?: number | null;
  locationLat?: number | null;
  locationLng?: number | null;
};

export type DashboardTrip = {
  id?: string;
  status?: string | null;
  driverId?: string | null;
  driver_id?: string | null;
  driver?: string | null;
  progress?: number | null;
  vehicleId?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  pickup_location?: string | null;
  destination_location?: string | null;
  pickup_zone?: string | null;
  destination_zone?: string | null;
  fromCoords?: { lat: number; lng: number } | null;
  toCoords?: { lat: number; lng: number } | null;
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
  createdAt?: string | null;
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
  drivers: Array<{
    id?: string;
    full_name?: string | null;
    name?: string | null;
    vehicle_id?: string | null;
  }>;
};

// Helper functions to calculate real data from API
const calculateFuelConsumptionData = (fuelLogs: any[], trips: DashboardTrip[]) => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date();
  
  return days.map((day, idx) => {
    const dayDate = new Date(today);
    dayDate.setDate(today.getDate() - (6 - idx));
    
    const dayLogs = fuelLogs.filter(log => {
      const logDate = new Date(log.loggedAt || log.logged_at);
      return logDate.toDateString() === dayDate.toDateString();
    });
    
    const consumption = dayLogs.reduce((sum, log) => sum + (log.liters || 0), 0);
    const efficiency = dayLogs.length > 0 && consumption > 0 
      ? (dayLogs.reduce((sum, log) => sum + (log.cost || 0), 0) / consumption).toFixed(1) 
      : "0.0";
    
    return { day, consumption, efficiency };
  });
};

const calculateCostBreakdownData = (costEntries: any[]) => {
  const breakdown: Record<string, number> = {
    "Fuel & Energy": 0,
    "Maintenance": 0,
    "Driver Payroll": 0,
    "Insurance & Tolls": 0,
  };

  costEntries.forEach(entry => {
    const category = entry.category || "Other";
    if (category.toLowerCase().includes("fuel")) breakdown["Fuel & Energy"] += entry.amount || 0;
    else if (category.toLowerCase().includes("maintenance")) breakdown["Maintenance"] += entry.amount || 0;
    else if (category.toLowerCase().includes("payroll") || category.toLowerCase().includes("driver")) breakdown["Driver Payroll"] += entry.amount || 0;
    else breakdown["Insurance & Tolls"] += entry.amount || 0;
  });

  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 1);
  
  return [
    { name: "Fuel & Energy", value: Math.round((breakdown["Fuel & Energy"] / total) * 100), color: "#b80049" },
    { name: "Maintenance", value: Math.round((breakdown["Maintenance"] / total) * 100), color: "#ec2188" },
    { name: "Driver Payroll", value: Math.round((breakdown["Driver Payroll"] / total) * 100), color: "#f472b6" },
    { name: "Insurance & Tolls", value: Math.round((breakdown["Insurance & Tolls"] / total) * 100), color: "#fda4af" },
  ];
};

const calculateFleetUtilizationData = (vehicles: DashboardVehicle[]) => {
  const vehiclesByType = vehicles.reduce((acc, v) => {
    const type = v.vehicleType || "Unknown";
    if (!acc[type]) acc[type] = { active: 0, idle: 0, maintenance: 0 };
    if (v.status === "active" || v.status === "moving") acc[type].active++;
    else if (v.status === "idle") acc[type].idle++;
    else acc[type].maintenance++;
    return acc;
  }, {} as Record<string, any>);
  
  return Object.entries(vehiclesByType).map(([category, data]) => ({
    category,
    active: data.active,
    idle: data.idle,
    maintenance: data.maintenance,
  }));
};

const calculateDeliveryPerformanceData = (trips: DashboardTrip[]) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const completedTrips = trips.filter(t => t.status === "completed").length;
  const delayedTrips = trips.filter(t => t.status === "delayed").length;
  
  return months.map((month) => {
    const totalTrips = trips.length > 0 ? trips.length : 1;
    const onTimePercentage = totalTrips > 0 && completedTrips > 0
      ? Math.max(0, 100 - Math.floor((delayedTrips / completedTrips) * 100))
      : 0;
    return {
      month,
      onTime: Math.min(100, onTimePercentage),
      delayed: Math.max(0, 100 - onTimePercentage),
    };
  });
};

const calculateParcelTrendData = (parcels: any[], timeframe: "daily" | "weekly" | "monthly" = "weekly") => {
  if (!Array.isArray(parcels) || parcels.length === 0) {
    return [];
  }

  const now = new Date();
  const trendMap: Record<string, number> = {};

  parcels.forEach((parcel) => {
    const createdDate = parcel.created_at ? new Date(parcel.created_at) : new Date();
    let key = "";

    if (timeframe === "daily") {
      key = createdDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (timeframe === "weekly") {
      const weekStart = new Date(createdDate);
      weekStart.setDate(createdDate.getDate() - createdDate.getDay());
      key = `W${Math.ceil(createdDate.getDate() / 7)}`;
    } else if (timeframe === "monthly") {
      key = createdDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }

    if (key) {
      trendMap[key] = (trendMap[key] || 0) + 1;
    }
  });

  // Generate periods
  let periods: string[] = [];
  if (timeframe === "daily") {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      periods.push(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }
  } else if (timeframe === "weekly") {
    for (let i = 3; i >= 0; i--) {
      periods.push(`W${4 - i}`);
    }
  } else if (timeframe === "monthly") {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    periods = months;
  }

  return periods.map((period) => ({
    period,
    count: trendMap[period] || 0,
  }));
};

const calculateWarehouseThroughputData = (bookings: DashboardBooking[]) => {
  const totalBookings = bookings.length || 1;
  return [
    { hour: "06:00", inbound: Math.floor(totalBookings * 0.1), outbound: Math.floor(totalBookings * 0.08), capacity: 200 },
    { hour: "09:00", inbound: Math.floor(totalBookings * 0.25), outbound: Math.floor(totalBookings * 0.22), capacity: 400 },
    { hour: "12:00", inbound: Math.floor(totalBookings * 0.35), outbound: Math.floor(totalBookings * 0.33), capacity: 500 },
    { hour: "15:00", inbound: Math.floor(totalBookings * 0.3), outbound: Math.floor(totalBookings * 0.36), capacity: 500 },
    { hour: "18:00", inbound: Math.floor(totalBookings * 0.2), outbound: Math.floor(totalBookings * 0.24), capacity: 400 },
    { hour: "21:00", inbound: Math.floor(totalBookings * 0.11), outbound: Math.floor(totalBookings * 0.12), capacity: 300 },
  ];
};

const calculateRouteCongestionData = (trips: DashboardTrip[]) => {
  // Group trips by route corridor based on pickup/destination
  const routeMap: Record<string, { active: number; total: number }> = {};

  const compactLocation = (value: string) => {
    const parts = value
      .split(/\s[–—-]\s|,/)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts[parts.length - 1] || value;
  };
  
  trips.forEach((trip) => {
    // Derive route name from pickup and destination locations (with multiple fallbacks)
    const pickupLocation = trip.pickup_location || trip.pickup_zone || trip.fromLocation || "Unknown";
    const destinationLocation = trip.destination_location || trip.destination_zone || trip.toLocation || "Unknown";
    const route = `${compactLocation(pickupLocation)} → ${compactLocation(destinationLocation)}`;
    
    if (!routeMap[route]) {
      routeMap[route] = { active: 0, total: 0 };
    }
    
    routeMap[route].total += 1;
    if (isInTransitStatus(trip.status)) {
      routeMap[route].active += 1;
    }
  });
  
  // Convert to array and calculate congestion index (0-100 scale)
  return Object.entries(routeMap)
    .slice(0, 5) // Show top 5 routes
    .map(([route, data]) => {
      const congestionIndex = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;
      return {
        route: route.length > 30 ? `${route.substring(0, 27)}...` : route,
        congestionIndex,
      };
    })
    .sort((a, b) => b.congestionIndex - a.congestionIndex); // Sort by congestion (highest first)
};

const calculateDriverSafetyScoreData = (drivers: Array<any>) => {
  const totalDrivers = drivers.length || 1;
  return [
    { tier: "95-100 (Elite)", count: Math.floor(totalDrivers * 0.3) },
    { tier: "85-94 (Good)", count: Math.floor(totalDrivers * 0.5) },
    { tier: "75-84 (Standard)", count: Math.floor(totalDrivers * 0.15) },
    { tier: "Below 75 (Review)", count: Math.floor(totalDrivers * 0.05) },
  ];
};

const isInTransitStatus = (status?: string | null) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  return /\b(in transit|active|assigned|scheduled|dispatch|moving|en route|on route|delayed|late)\b/.test(normalized);
};

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
] as const;

export default function Home() {
  // Get data from parcel store (same as missions page)
  const { bookings: storeBookings, parcels: storeParcels, drivers: storeDrivers } = useParcelStore();
  const [dashboardFullscreen, setDashboardFullscreen] = useState(false);
  const [hiddenKPIs, setHiddenKPIs] = useState<Set<string>>(new Set(KPI_IDS));

  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    vehicles: [],
    trips: [],
    bookings: [],
    drivers: [],
  });
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [costEntries, setCostEntries] = useState<any[]>([]);
  const [parcels, setParcels] = useState<any[]>([]);
  const [parcelTimeframe, setParcelTimeframe] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const [trips, vehicles, bookings, drivers, fuelData, costData, parcelData] = await Promise.all([
        getTrips({ light: true }),
        getVehicles(),
        getBookings(),
        getDrivers(),
        getFuelLogs(),
        getCostEntries(),
        getParcels(),
      ]);

      const mergedBookings = Array.isArray(bookings) ? bookings : [...storeBookings];
      const mergedDrivers = Array.isArray(drivers) ? drivers : [...storeDrivers];
      const mergedParcels = Array.isArray(parcelData) ? [...parcelData, ...storeParcels] : [...storeParcels];

      setSnapshot({
        vehicles: Array.isArray(vehicles) ? vehicles : [],
        trips: Array.isArray(trips) ? trips : [],
        bookings: mergedBookings,
        drivers: mergedDrivers,
      });
      setFuelLogs(Array.isArray(fuelData) ? fuelData : []);
      setCostEntries(Array.isArray(costData) ? costData : []);
      setParcels(mergedParcels);
    } catch (requestError) {
      console.error("Failed to load dashboard data:", requestError);
      setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      setError(null);
      setIsLoading(true);

      try {
        const [trips, vehicles, bookings] = await Promise.all([
          getTrips({ light: true }),
          getVehicles(),
          getBookings(),
        ]);

        if (!active) return;

        const mergedBookings = Array.isArray(bookings) ? bookings : [...storeBookings];
        setSnapshot({
          vehicles: Array.isArray(vehicles) ? vehicles : [],
          trips: Array.isArray(trips) ? trips : [],
          bookings: mergedBookings,
          drivers: [...storeDrivers],
        });
        setIsLoading(false);

        try {
          const [drivers, fuelData, costData, parcelData] = await Promise.all([
            getDrivers(),
            getFuelLogs(),
            getCostEntries(),
            getParcels(),
          ]);

          if (!active) return;

          const mergedDrivers = Array.isArray(drivers) ? drivers : [...storeDrivers];
          const mergedParcels = Array.isArray(parcelData) ? [...parcelData, ...storeParcels] : [...storeParcels];
          setSnapshot((current) => ({ ...current, drivers: mergedDrivers }));
          setFuelLogs(Array.isArray(fuelData) ? fuelData : []);
          setCostEntries(Array.isArray(costData) ? costData : []);
          setParcels(mergedParcels);
        } catch (analyticsError) {
          console.warn("Dashboard analytics data is unavailable:", analyticsError);
        }
      } catch (requestError) {
        console.error("Failed to load dashboard data:", requestError);
        if (active) setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard data.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    const loadingTimeout = window.setTimeout(() => {
      if (active) setIsLoading(false);
    }, 3000);

    void run();

    return () => {
      active = false;
      window.clearTimeout(loadingTimeout);
    };
  }, [storeBookings, storeParcels, storeDrivers]);

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
            onClick={() => void loadDashboard()}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-pink-600/25 hover:from-pink-700 hover:to-rose-700 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Reconnect Stream
          </button>
        </div>
      </div>
    );
  }

  if (isLoading && !snapshot.trips.length && !snapshot.vehicles.length && !snapshot.bookings.length) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-pink-50/60 via-white to-rose-50/40 text-slate-800 font-sans w-full">
        <GlobalNavbar />
        <main className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3 rounded-xl border border-pink-100 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
            <span className="material-symbols-outlined animate-spin text-pink-600">progress_activity</span>
            Loading dashboard…
          </div>
        </main>
      </div>
    );
  }

  const activeTripsCount = snapshot.trips.filter((trip) => isInTransitStatus(trip.status)).length;
  const activeVehiclesCount = snapshot.vehicles.filter((v) => v.status === "active" || v.status === "moving").length;
  const pendingBookingsCount = snapshot.bookings.filter((b) => b.status === "pending").length;
  const totalVehiclesCount = snapshot.vehicles.length;
  const totalTripsCount = snapshot.trips.length;
  const totalBookingsCount = snapshot.bookings.length;
  const tripDriverIds = new Set<string>();
  snapshot.trips.forEach((trip) => {
    const driverId = trip.driverId || trip.driver_id;
    if (driverId) tripDriverIds.add(driverId);
  });
  const assignedDriverKeys = new Set<string>();
  if (tripDriverIds.size > 0) {
    tripDriverIds.forEach((driverId) => assignedDriverKeys.add(`id:${driverId}`));
  } else {
    snapshot.drivers.forEach((driver) => {
      if (driver.vehicle_id && driver.id) assignedDriverKeys.add(`id:${driver.id}`);
    });
    snapshot.vehicles.forEach((vehicle) => {
      const driverKey = vehicle.driver_id || vehicle.driverName || vehicle.driver;
      if (driverKey) assignedDriverKeys.add(`vehicle:${driverKey}`);
    });
  }
  const totalDriversCount = assignedDriverKeys.size;

  // Calculate real metrics
  const fuelConsumptionData = calculateFuelConsumptionData(fuelLogs, snapshot.trips);
  const costBreakdownData = calculateCostBreakdownData(costEntries);
  const fleetUtilizationData = calculateFleetUtilizationData(snapshot.vehicles);
  const deliveryPerformanceData = calculateDeliveryPerformanceData(snapshot.trips);
  const parcelTrendData = calculateParcelTrendData(parcels, parcelTimeframe);
  const warehouseThroughputData = calculateWarehouseThroughputData(snapshot.bookings);
  const routeCongestionData = calculateRouteCongestionData(snapshot.trips);
  const driverSafetyScoreData = calculateDriverSafetyScoreData(snapshot.drivers);

  // Calculate KPI values from real data
  const fleetEfficiency = fuelLogs.length > 0 && fuelLogs.reduce((sum, log) => sum + (log.liters || 0), 0) > 0
    ? (fuelLogs.reduce((sum, log) => sum + (log.cost || 0), 0) / fuelLogs.reduce((sum, log) => sum + (log.liters || 0), 1)).toFixed(1)
    : "0.0";
  
  const completedTrips = snapshot.trips.filter(t => t.status === "completed").length;
  const onTimeTrips = completedTrips - snapshot.trips.filter(t => t.status === "delayed").length;
  const onTimeRate = completedTrips > 0 
    ? ((onTimeTrips / completedTrips) * 100).toFixed(1) 
    : "0.0";
  
  const systemHealth = snapshot.vehicles.length > 0 && snapshot.trips.length > 0
    ? "Optimal" 
    : (snapshot.vehicles.length > 0 ? "Good" : "Offline");

  // Calculate parcel-related KPI values
  const totalParcelsCount = parcels.length;
  const avgParcelsPerTrip = snapshot.trips.length > 0 
    ? (totalParcelsCount / snapshot.trips.length).toFixed(1) 
    : "0.0";
  
  const totalParcelsWeight = parcels.reduce((sum, p) => sum + (p.weight_kg || 0), 0);
  const avgParcelWeight = totalParcelsCount > 0 
    ? (totalParcelsWeight / totalParcelsCount).toFixed(2) 
    : "0.0";
  
  const uniqueRoutes = new Set(
    snapshot.trips
      .map(t => `${t.pickup_location || t.fromLocation || ""}->${t.destination_location || t.toLocation || ""}`)
      .filter(r => r !== "->")
  ).size;
  
  const totalVehicleCapacity = snapshot.vehicles.reduce((sum, v) => sum + (v.capacityKg || 0), 0);
  const warehouseUtilization = totalVehicleCapacity > 0
    ? Math.round((totalParcelsWeight / totalVehicleCapacity) * 100)
    : 0;

  // Calculate fuel management KPI values
  const totalFuelConsumed = fuelLogs.reduce((sum, log) => sum + (log.liters || 0), 0);
  const totalFuelCost = fuelLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const fuelEfficiencyRatio = totalFuelConsumed > 0 
    ? (totalFuelCost / totalFuelConsumed).toFixed(2) 
    : "0.00";
  const avgFuelPerTrip = snapshot.trips.length > 0 
    ? (totalFuelConsumed / snapshot.trips.length).toFixed(2) 
    : "0.00";
  const avgFuelCostPerTrip = snapshot.trips.length > 0 
    ? (totalFuelCost / snapshot.trips.length).toFixed(2) 
    : "0.00";

  // Calculate cost analysis KPI values
  const totalOperatingCost = costEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const fuelCostPercentage = totalOperatingCost > 0 
    ? ((totalFuelCost / totalOperatingCost) * 100).toFixed(1) 
    : "0.0";
  const maintenanceCost = costEntries.filter(e => /maintenance|service|repair/i.test(e.category || "")).reduce((sum, e) => sum + (e.amount || 0), 0);
  const driverAllowanceCost = costEntries.filter((entry) => /driver\s*allowance|allowance/i.test(String(entry.category || ""))).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const mobileDataCost = costEntries.filter((entry) => /mobile\s*data|data\s*(?:&|and)?\s*internet|internet/i.test(String(entry.category || ""))).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const avgCostPerVehicle = snapshot.vehicles.length > 0 
    ? (totalOperatingCost / snapshot.vehicles.length).toFixed(2) 
    : "0.00";
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
    "on-time-rate": `${onTimeRate}%`,
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

  if (dashboardFullscreen) {
    return (
      <div className="fixed inset-0 z-[9998] bg-background text-on-background">
        <MapSection
          trips={snapshot.trips}
          vehicles={snapshot.vehicles}
          bookings={snapshot.bookings}
          parcels={parcels}
          drivers={snapshot.drivers}
          isFullscreen={true}
          onToggleFullscreen={() => setDashboardFullscreen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-background font-sans w-full">
      <GlobalNavbar />

      <main className="flex-1 w-full px-4 sm:px-6 py-6 space-y-6 bg-background">
        
        {/* Top Header Command Banner */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-surface-container-lowest backdrop-blur-md rounded-2xl p-6 border border-outline-variant shadow-soft w-full">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Logistics Command Center
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700 border border-pink-200/80">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Telemetry
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Full-width real-time dispatch overview, vehicle tracking, comprehensive cost analysis, and advanced fleet optimization analytics.
            </p>
          </div>
        </div>

        {/* Top KPI Cards - Clean Essentials Only (15 Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2.5 w-full">
          
          {/* Card 1: Active Vehicles */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('active-vehicles')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">directions_car</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700">Live</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('active-vehicles', activeVehiclesCount)}{renderKPITrend('active-vehicles')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Active Vehicles</div>
            </div>
          </div>

          {/* Card 2: In-Transit Trips */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('in-transit')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">alt_route</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Active</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('in-transit', activeTripsCount)}{renderKPITrend('in-transit')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">In Transit</div>
            </div>
          </div>

          {/* Card 3: Pending Bookings */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('pending-bookings')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">book_online</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Queue</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('pending-bookings', pendingBookingsCount)}{renderKPITrend('pending-bookings')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Pending Bookings</div>
            </div>
          </div>

          {/* Card 4: Total Vehicles */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('total-vehicles')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">local_shipping</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700">Fleet</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('total-vehicles', totalVehiclesCount)}{renderKPITrend('total-vehicles')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Total Vehicles</div>
            </div>
          </div>

          {/* Card 5: Completed Trips */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('completed-trips')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">done</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Done</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('completed-trips', completedTrips)}{renderKPITrend('completed-trips')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Completed Trips</div>
            </div>
          </div>

          {/* Card 6: Total Bookings */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('total-bookings')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700">Orders</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('total-bookings', totalBookingsCount)}{renderKPITrend('total-bookings')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Total Bookings</div>
            </div>
          </div>

          {/* Card 7: Registered Drivers */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('total-drivers')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">badge</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700">Staff</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('total-drivers', totalDriversCount)}{renderKPITrend('total-drivers')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Drivers Assigned</div>
            </div>
          </div>

          {/* Card 8: Fleet Efficiency */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('fleet-efficiency')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">bolt</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Avg</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('fleet-efficiency', fleetEfficiency)} km/L{renderKPITrend('fleet-efficiency')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Fleet Efficiency</div>
            </div>
          </div>

          {/* Card 9: On-Time Rate */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('on-time-rate')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">trending_up</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700">KPI</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('on-time-rate', onTimeRate)}%{renderKPITrend('on-time-rate')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">On-Time Rate</div>
            </div>
          </div>

          {/* Card 10: System Health */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('system-health')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">100%</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('system-health', systemHealth)}{renderKPITrend('system-health')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">System Health</div>
            </div>
          </div>

          {/* Card 11: Total Parcels */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('total-parcels')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">local_shipping</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Count</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('total-parcels', totalParcelsCount)}{renderKPITrend('total-parcels')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Total Parcels</div>
            </div>
          </div>

          {/* Card 12: Total Fuel Consumed */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('total-fuel')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">local_gas_station</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Fuel</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('total-fuel', totalFuelConsumed.toFixed(1))}L{renderKPITrend('total-fuel')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Total Fuel</div>
            </div>
          </div>

          {/* Card 15: Total Operating Cost */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('operating-cost')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700">Cost</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('operating-cost', `₱${totalOperatingCost.toFixed(2)}`)}{renderKPITrend('operating-cost')}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Operating Cost</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('driver-allowance')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">payments</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">Driver</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('driver-allowance', `₱${driverAllowanceCost.toFixed(2)}`)}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Driver Allowance</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 cursor-pointer hover:border-pink-300 transition-colors" onClick={() => toggleKPIVisibility('mobile-data')}>
            <div className="flex items-center justify-between text-[#b80049]">
              <span className="material-symbols-outlined text-[20px]">wifi</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">Data</span>
            </div>
            <div className="mt-2">
              <div className="text-lg font-black text-slate-900">{renderKPIValue('mobile-data', `₱${mobileDataCost.toFixed(2)}`)}</div>
              <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">Data &amp; Internet</div>
            </div>
          </div>

        </div>

        {/* 12-Column Full-Width Responsive Dashboard Grid - Map Centered with Charts on Sides */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full">
          
          {/* Left Column: Fuel Consumption & Fleet Utilization Charts */}
          <section className="col-span-12 lg:col-span-3 flex flex-col gap-6">
            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5">
              <SpecializedLogistics 
                trips={snapshot.trips} 
                vehicles={snapshot.vehicles} 
                bookings={snapshot.bookings} 
              />
            </div>

            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5">
              <PerformanceMetrics 
                trips={snapshot.trips} 
                vehicles={snapshot.vehicles} 
              />
            </div>

            {/* Fuel Consumption & Efficiency Chart - Left Side */}
            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5 flex flex-col justify-between">
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
              </div>
            </div>

            {/* Fleet Utilization Chart */}
            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Fleet Utilization</h3>
                  <p className="text-xs text-slate-500">Status across categories</p>
                </div>
                <span className="p-2 rounded-xl bg-pink-50 text-[#b80049]">
                  <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                </span>
              </div>
              <div className="h-[200px] w-full">
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
            </div>
          </section>

          {/* Center Column: Live Fleet Map */}
          <section className="col-span-12 lg:col-span-6 flex flex-col gap-6">
            {/* Live Fleet Map Section - Center Focus */}
            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5 flex-grow">
              <MapSection 
                trips={snapshot.trips}
                vehicles={snapshot.vehicles}
                bookings={snapshot.bookings}
                parcels={parcels}
                drivers={snapshot.drivers}
                isFullscreen={false}
                onToggleFullscreen={() => setDashboardFullscreen(true)}
              />
            </div>

            {/* Center column secondary charts below map */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Warehouse Throughput */}
              <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5 flex flex-col justify-between">
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

              {/* Route Congestion Index */}
              <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Route Congestion</h3>
                    <p className="text-xs text-slate-500">Traffic bottleneck score</p>
                  </div>
                  <span className="p-2 rounded-xl bg-pink-50 text-[#b80049]">
                    <span className="material-symbols-outlined text-[18px]">traffic</span>
                  </span>
                </div>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={routeCongestionData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
                      <YAxis dataKey="route" type="category" tick={{ fontSize: 9, fill: "#64748b" }} width={80} />
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #fbcfe8" }} />
                      <Bar dataKey="congestionIndex" name="Index" fill="#ec2188" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5">
              <MissionLogs 
                trips={snapshot.trips} 
              />
            </div>
          </section>

          {/* Right Column: Delivery Performance & Driver Safety Charts */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col gap-6">
            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5">
              <ResourceData 
                bookings={snapshot.bookings} 
              />
            </div>

            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5">
              <SensorHub 
                vehicles={snapshot.vehicles}
                trips={snapshot.trips}
              />
            </div>

            {/* Delivery Performance Chart - Right Side */}
            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5 flex flex-col justify-between">
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

            {/* Fleet Cost Breakdown moved to Right Column */}
            <div className="rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-5 shadow-sm shadow-pink-500/5">
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
                <ResponsiveContainer width="100%" height="100%">
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
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #fbcfe8" }} />
                    <Legend iconSize={7} wrapperStyle={{ fontSize: "10px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </aside>

        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
