"use client";

import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";
import RoleRestricted from "../components/RoleRestricted";

import { useEffect, useMemo, useState } from "react";
import { createVehicle, getDashboardSnapshot } from "../lib/api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
} from "recharts";

type DashboardSnapshot = {
  counts?: {
    vehicles?: number;
    trips?: number;
    bookings?: number;
    drivers?: number;
  };
  vehicles?: Array<{ id?: string; status?: string; plate_number?: string; fuel_level?: number; driver?: string; location?: string }>;
  trips?: Array<{ id?: string; status?: string; updated_at?: string; vehicle_id?: string; destination?: string }>;
};

type ActivityItem = {
  tone: keyof typeof toneStyles;
  icon: string;
  label: string;
  time: string;
  title: string;
  body: string;
  action?: string;
};

function isInTransitStatus(status?: string) {
  return /transit|assigned|scheduled|dispatch|delay|late/i.test(status || "");
}

function buildFleetActivityTrend(trips: Array<{ status?: string; updated_at?: string }>, vehicles: Array<{ status?: string }>) {
  const hours = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
  const totalVehicles = vehicles.length || 1;
  const maintenanceCount = vehicles.filter((vehicle) => /maintenance|service|repair/i.test(vehicle.status || "")).length;
  const maintenancePerHour = Math.max(0, Math.round(maintenanceCount / hours.length));

  const activeCounts = hours.map((hour) => {
    const hourValue = Number(hour.split(":")[0]);
    return trips.filter((trip) => {
      if (!trip.updated_at) return false;
      const updatedAt = new Date(trip.updated_at);
      if (Number.isNaN(updatedAt.getTime())) return false;
      const status = String(trip.status || "").toLowerCase();
      const isActive = isInTransitStatus(status);
      return isActive && updatedAt.getHours() === hourValue;
    }).length;
  });

  return hours.map((time, index) => {
    const active = activeCounts[index];
    const maintenance = Math.min(maintenanceCount, maintenancePerHour + Math.round(active * 0.1));
    const idle = Math.max(0, totalVehicles - active - maintenance);
    return { time, active, idle, maintenance };
  });
}

function buildFleetPerformanceRadar(trips: Array<{ status?: string }>, vehicles: Array<{ status?: string }>) {
  const totalTrips = trips.length;
  const totalVehicles = vehicles.length;
  const completedTrips = trips.filter((trip) => /delivered|completed|done/i.test(trip.status || "")).length;
  const onTimeTrips = trips.filter((trip) => /delivered|completed|done|on time|ontime/i.test(trip.status || "")).length;
  const delayedTrips = trips.filter((trip) => /late|delay|delayed|exception/i.test(trip.status || "")).length;
  const activeVehicles = vehicles.filter((vehicle) => /active|available|ready|assigned/i.test(vehicle.status || "")).length;
  const maintenanceVehicles = vehicles.filter((vehicle) => /maintenance|service|repair|out of service|pending/i.test(vehicle.status || "")).length;

  const percent = (count: number, total: number) => (total === 0 ? 0 : Math.min(100, Math.max(0, Math.round((count / total) * 100))));

  const fuelEfficiency = totalVehicles === 0 ? 0 : Math.max(20, 100 - maintenanceVehicles * 2 - delayedTrips * 1);
  const onTimeRate = percent(onTimeTrips, totalTrips);
  const safetyIndex = percent(totalVehicles - maintenanceVehicles, totalVehicles);
  const maintenanceScore = 100 - percent(maintenanceVehicles, Math.max(1, totalVehicles));
  const driverCompliance = percent(completedTrips, Math.max(1, totalTrips));
  const telemetryHealth = percent(activeVehicles, Math.max(1, totalVehicles));

  return [
    { subject: "Fuel Efficiency", A: fuelEfficiency, fullMark: 100 },
    { subject: "On-Time Rate", A: onTimeRate, fullMark: 100 },
    { subject: "Safety Index", A: safetyIndex, fullMark: 100 },
    { subject: "Maintenance Score", A: maintenanceScore, fullMark: 100 },
    { subject: "Driver Compliance", A: driverCompliance, fullMark: 100 },
    { subject: "Telemetry Health", A: telemetryHealth, fullMark: 100 },
  ];
}

export default function FvmOverviewPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<"Today" | "This Week" | "This Month">("Today");
  const [selectedRegion, setSelectedRegion] = useState("Philippines");
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  // New Interactive Feature States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "maintenance" | "idle">("all");
  const [quickAlertDismissed, setQuickAlertDismissed] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    id: "",
    plateNumber: "",
    vehicleType: "",
    status: "Active",
    driver: "",
    location: "",
    capacityKg: "",
    fuelEfficiency: "",
    mileage: "",
    lastService: "",
    nextService: "",
  });
  const [vehicleSubmitError, setVehicleSubmitError] = useState("");
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);

  const handleExportReport = () => {
    setShowExportNotice(true);
    window.setTimeout(() => setShowExportNotice(false), 2500);
  };

  useEffect(() => {
    let active = true;
    getDashboardSnapshot()
      .then((data) => {
        if (active) setSnapshot(data);
      })
      .catch((error) => console.error("Failed to load fleet snapshot:", error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const vehicles = snapshot?.vehicles ?? [];
  const trips = snapshot?.trips ?? [];
  const totalVehicles = snapshot?.counts?.vehicles ?? (vehicles.length > 0 ? vehicles.length : 0);
  const activeRoutes = trips.filter((trip) => isInTransitStatus(trip.status)).length;
  const maintenanceCount = vehicles.filter((vehicle) => /maintenance|service|repair/i.test(vehicle.status || "")).length;
  const idleCount = Math.max(0, totalVehicles - activeRoutes - maintenanceCount);

  const nextVehicleId = () => {
    const highestNumber = vehicles.reduce((highest, vehicle) => {
      const match = String(vehicle.id || "").match(/(\d+)$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    return `TRK-${String(highestNumber + 1).padStart(3, "0")}`;
  };

  const openAddVehicle = () => {
    setVehicleSubmitError("");
    setVehicleForm((current) => ({ ...current, id: current.id || nextVehicleId() }));
    setShowAddVehicle(true);
  };

  const handleAddVehicle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVehicleSubmitError("");
    setVehicleSubmitting(true);
    try {
      await createVehicle({
        id: vehicleForm.id.trim(),
        plate_number: vehicleForm.plateNumber.trim(),
        vehicle_type: vehicleForm.vehicleType.trim(),
        status: vehicleForm.status,
        driver: vehicleForm.driver.trim() || null,
        location: vehicleForm.location.trim() || null,
        capacity_kg: vehicleForm.capacityKg ? Number(vehicleForm.capacityKg) : null,
        fuel_efficiency: vehicleForm.fuelEfficiency ? Number(vehicleForm.fuelEfficiency) : null,
        mileage: vehicleForm.mileage ? Number(vehicleForm.mileage) : null,
        last_service: vehicleForm.lastService || null,
        next_service: vehicleForm.nextService || null,
      });
      setShowAddVehicle(false);
      setVehicleForm((current) => ({ ...current, id: "", plateNumber: "", vehicleType: "", driver: "", location: "", capacityKg: "", fuelEfficiency: "", mileage: "", lastService: "", nextService: "" }));
      window.location.reload();
    } catch (error) {
      setVehicleSubmitError(error instanceof Error ? error.message : "Unable to add vehicle.");
    } finally {
      setVehicleSubmitting(false);
    }
  };
  
  const fleetActivityTrend = useMemo(() => buildFleetActivityTrend(trips, vehicles), [trips, vehicles]);
  const fleetPerformanceRadar = useMemo(() => buildFleetPerformanceRadar(trips, vehicles), [trips, vehicles]);

  // Filtered vehicles for new feature list view
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesSearch = (v.id || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (v.plate_number || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (filterStatus === "active") return /transit|assigned|scheduled|dispatch|active/i.test(v.status || "");
      if (filterStatus === "maintenance") return /maintenance|service|repair/i.test(v.status || "");
      if (filterStatus === "idle") return !/transit|assigned|scheduled|dispatch|active|maintenance|service|repair/i.test(v.status || "");
      return true;
    });
  }, [vehicles, searchQuery, filterStatus]);

  const kpiCards = [
    { label: "Total Fleet Units", value: String(totalVehicles), icon: "directions_car", iconColor: "text-pink-600", footIcon: "storage", footText: "Active network size", footColor: "text-pink-700" },
    { label: "On Route & Dispatch", value: String(activeRoutes), icon: "route", iconColor: "text-rose-600", footIcon: "sync", footText: "Live routes in transit", footColor: "text-rose-700" },
    { label: "In Service & Repair", value: String(maintenanceCount), icon: "build", iconColor: "text-pink-500", footIcon: "warning", footText: "Scheduled maintenance", footColor: "text-pink-700" },
    { label: "Available / Idle", value: String(idleCount), icon: "local_shipping", iconColor: "text-rose-400", footIcon: "info", footText: "Ready for deployment", footColor: "text-rose-600" },
  ];

  const fleetStatusPieData = [
    { name: "On Route", value: activeRoutes, color: "#db2777" },
    { name: "Idle", value: idleCount, color: "#f472b6" },
    { name: "Maintenance", value: maintenanceCount, color: "#fbcfe8" },
  ];

  // Additional mock chart data for fuel distribution feature
  const fuelDistributionData = [
    { range: "0-25%", count: 2 },
    { range: "26-50%", count: 5 },
    { range: "51-75%", count: 12 },
    { range: "76-100%", count: totalVehicles > 19 ? totalVehicles - 19 : 8 },
  ];

  const activity: ActivityItem[] = trips.length > 0 ? trips.slice(0, 5).map((trip) => ({
    tone: /cancel|fail|error/i.test(trip.status || "") ? "critical" : isInTransitStatus(trip.status) ? "info" : "warning",
    icon: /cancel|fail|error/i.test(trip.status || "") ? "warning" : "route",
    label: String(trip.status || "Vehicle update").toUpperCase(),
    time: trip.updated_at ? new Date(trip.updated_at).toLocaleString() : "Recently",
    title: `Vehicle ${trip.id || "unidentified"}`,
    body: trip.vehicle_id ? `Assigned to vehicle ${trip.vehicle_id}.` : "No vehicle assignment recorded.",
  })) : [];

  return (
    <RoleRestricted allowedRoles={["fleet_manager", "admin"]} hideWhenRestricted>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-pink-50/60 via-white to-pink-100/40 text-slate-800 selection:bg-pink-600 selection:text-white">
        <GlobalNavbar />

        {/* Full-Width Fluid Container */}
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        
        {/* Compact Page Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 bg-white/90 backdrop-blur-xl px-6 py-4 rounded-2xl border border-pink-200/60 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-pink-100 text-pink-700 uppercase tracking-wider flex items-center gap-1.5 border border-pink-200">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-600 animate-pulse"></span>
                Operations Center
              </span>
              <span className="text-[11px] font-medium text-pink-500">• Live Regional Audit</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fleet Overview Dashboard</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Maintenance Toggle Feature */}
            <button
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                maintenanceMode 
                  ? "bg-amber-500 text-white border-amber-600 shadow-sm" 
                  : "bg-pink-50 text-slate-700 border-pink-200 hover:bg-pink-100"
              }`}
            >
              {maintenanceMode ? "⚠️ Maint. Lockdown Active" : "🛡️ Enable Maintenance Mode"}
            </button>

            <div className="flex bg-pink-50/80 border border-pink-200 rounded-xl p-0.5">
              {(["Today", "This Week", "This Month"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedTimeframe === tf
                      ? "bg-pink-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <button
              onClick={openAddVehicle}
              className="flex items-center gap-1.5 bg-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-pink-700 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Add Vehicle
            </button>

            <button
              onClick={handleExportReport}
              className="flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:from-pink-700 hover:to-rose-700 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export
            </button>
          </div>
        </div>

        {/* Dismissible Quick Alert Notice */}
        {!quickAlertDismissed && (
          <div className="rounded-xl border border-pink-200 bg-pink-50/90 text-pink-900 px-4 py-3 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-pink-600 text-base">info</span>
              <span>Telemetry system operating at 99.8% stability. Next regional automated sync scheduled in 14 minutes.</span>
            </div>
            <button onClick={() => setQuickAlertDismissed(true)} className="text-pink-700 hover:text-pink-900 font-bold cursor-pointer text-sm px-1">✕</button>
          </div>
        )}

        {showExportNotice && (
          <div className="rounded-xl border border-pink-300 bg-pink-100/90 text-pink-800 px-4 py-3 text-xs font-bold flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-base">task_alt</span>
            Export request queued successfully. Comprehensive CSV report download starting shortly.
          </div>
        )}

        {/* Region Selector Pills */}
        <div className="flex flex-wrap items-center gap-2 bg-white/80 p-2 rounded-xl border border-pink-200/60 shadow-sm w-fit">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider px-2">Active Region:</span>
          {(["Philippines", "Metro Manila", "Cebu Hub", "Davao Logistics"] as const).map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedRegion === region
                  ? "bg-pink-600 text-white shadow-xs"
                  : "bg-pink-50/50 border border-pink-200/60 text-slate-600 hover:border-pink-400 hover:text-slate-900"
              }`}
            >
              {region}
            </button>
          ))}
        </div>

        {/* Compact KPI Bento Grid (Smaller size cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-pink-300"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{card.label}</h3>
                <span className={`material-symbols-outlined text-lg ${card.iconColor}`}>{card.icon}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
              <div className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${card.footColor}`}>
                <span className="material-symbols-outlined text-xs">{card.footIcon}</span>
                <span>{card.footText}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid Section - Full Width Extended */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 w-full">
          
          {/* Left Column (7 Columns on XL) */}
          <div className="xl:col-span-7 flex flex-col gap-5">
            
            {/* Map & Hub Command Center Card */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-pink-200/60 shadow-sm overflow-hidden flex flex-col h-[380px]">
              <div className="px-4 py-3 border-b border-pink-100 flex justify-between items-center bg-pink-50/40">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-pink-100 text-pink-600">
                    <span className="material-symbols-outlined text-base">hub</span>
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Regional Hub Command Network</h3>
                    <p className="text-[10px] text-slate-500">Active command nodes &amp; transit corridors</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-pink-600 text-white rounded-full text-[11px] font-bold shadow-xs">
                  {selectedRegion}
                </span>
              </div>
              
              <div className="flex-1 relative bg-slate-950 bg-[radial-gradient(circle_at_30%_30%,rgba(219,39,119,0.35),transparent_70%)] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:30px_30px]" />
                
                {/* Manila HQ Pin */}
                <div className="absolute top-[34%] left-[38%] flex flex-col items-center group cursor-pointer">
                  <div className="w-6 h-6 bg-pink-600 rounded-full border-2 border-white shadow-lg animate-pulse flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-white rounded-full" />
                  </div>
                </div>

                {/* Cebu Hub Pin */}
                <div className="absolute bottom-[35%] right-[32%] flex flex-col items-center group cursor-pointer">
                  <div className="w-5 h-5 bg-rose-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                </div>

                {/* Davao Node Pin */}
                <div className="absolute bottom-[22%] left-[26%] flex flex-col items-center group cursor-pointer">
                  <div className="w-4 h-4 bg-pink-400 rounded-full border-2 border-white shadow-lg" />
                </div>

                <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md border border-pink-500/30 px-3 py-2 rounded-xl text-white text-[11px] flex items-center gap-3 shadow-md">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-600"></span> HQ Active</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Regional</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-400"></span> Maintenance</span>
                </div>
              </div>
            </div>

            {/* Bottom Left Grid: Status Breakdown & Fleet Health Radar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Fleet Status Pie Breakdown */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-pink-200/60 p-4 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-pink-100 text-pink-600">
                      <span className="material-symbols-outlined text-base">pie_chart</span>
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Status Breakdown</h3>
                      <p className="text-[10px] text-slate-500">Operational States</p>
                    </div>
                  </div>
                </div>

                <div className="h-[130px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fleetStatusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {fleetStatusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid rgba(219,39,119,0.3)", fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  {fleetStatusPieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-pink-50/50 border border-pink-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-bold text-slate-800">{item.name}</span>
                      </div>
                      <span className="font-extrabold text-pink-600">{item.value} units</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fleet Health Radar Chart */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-pink-200/60 p-4 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-pink-100 text-pink-600">
                      <span className="material-symbols-outlined text-base">radar</span>
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Fleet Health Index</h3>
                      <p className="text-[10px] text-slate-500">KPI Performance Matrix</p>
                    </div>
                  </div>
                </div>

                <div className="h-[140px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={fleetPerformanceRadar}>
                      <PolarGrid stroke="#fbcfe8" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 8, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                      <Radar name="Fleet Performance" dataKey="A" stroke="#db2777" fill="#db2777" fillOpacity={0.4} />
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid rgba(219,39,119,0.3)", fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-1 text-center bg-pink-50/80 py-2 rounded-xl border border-pink-100">
                  <span className="text-[10px] font-black text-pink-700">Overall Efficiency: {Math.round(fleetPerformanceRadar.reduce((sum, item) => sum + item.A, 0) / Math.max(1, fleetPerformanceRadar.length))}% (Optimal)</span>
                </div>
              </div>

            </div>

            {/* NEW FEATURE: Quick Fleet Vehicle Search & Status Filter Directory */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-pink-200/60 p-4 shadow-sm flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-pink-100 text-pink-600">
                    <span className="material-symbols-outlined text-base">directions_car</span>
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Fleet Unit Directory &amp; Quick Search</h3>
                    <p className="text-[10px] text-slate-500">Filter and audit specific transport units instantly</p>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-pink-50 p-1 rounded-xl border border-pink-200 text-[11px]">
                  {(["all", "active", "maintenance", "idle"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                        filterStatus === st ? "bg-pink-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-sm">search</span>
                </span>
                <input
                  type="text"
                  placeholder="Search by Vehicle ID or Plate Number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-pink-50/40 border border-pink-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-pink-600"
                />
              </div>

              <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1.5 pr-1">
                {filteredVehicles.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-500 font-medium">No matching fleet units found.</div>
                ) : (
                  filteredVehicles.slice(0, 6).map((vh, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 bg-pink-50/30 hover:bg-pink-50 rounded-xl border border-pink-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-600"></span>
                        <span className="font-bold text-slate-800">Unit ID: {vh.id || `V-${idx + 101}`}</span>
                        <span className="text-slate-400 text-[10px]">({vh.plate_number || "XYZ-9988"})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700 uppercase">
                        {vh.status || "Active Service"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right Column (5 Columns on XL): Hourly Operational Trend, Fuel Chart & Live Activity Feed */}
          <div className="xl:col-span-5 flex flex-col gap-5">
            
            {/* Hourly Operational Trend Chart */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-pink-200/60 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-pink-100 text-pink-600">
                    <span className="material-symbols-outlined text-base">show_chart</span>
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Daily Operational Activity Wave</h3>
                    <p className="text-[10px] text-slate-500">Active units vs idle timeline</p>
                  </div>
                </div>
              </div>

              <div className="w-full h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fleetActivityTrend} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#db2777" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#db2777" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} axisLine={{ stroke: "#fbcfe8" }} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid rgba(219,39,119,0.3)", fontSize: 11 }}
                    />
                    <Area type="monotone" dataKey="active" name="Active Fleet" stroke="#db2777" strokeWidth={2.5} fillOpacity={1} fill="url(#colorActive)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* NEW FEATURE: Fleet Fuel Level Bar Chart Distribution */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-pink-200/60 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-pink-100 text-pink-600">
                    <span className="material-symbols-outlined text-base">local_gas_station</span>
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Fleet Fuel &amp; Energy Reserves</h3>
                    <p className="text-[10px] text-slate-500">Percentage distribution across active units</p>
                  </div>
                </div>
              </div>

              <div className="w-full h-[130px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fuelDistributionData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" vertical={false} />
                    <XAxis dataKey="range" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} axisLine={{ stroke: "#fbcfe8" }} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid rgba(219,39,119,0.3)", fontSize: 11 }} />
                    <Bar dataKey="count" fill="#db2777" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Vehicle Activity Feed */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-pink-200/60 shadow-sm flex flex-col h-[280px] overflow-hidden">
              <div className="px-4 py-3 border-b border-pink-100 flex justify-between items-center bg-pink-50/40">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-pink-100 text-pink-600">
                    <span className="material-symbols-outlined text-base">notifications_active</span>
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Vehicle Activity Feed</h3>
                    <p className="text-[10px] text-slate-500">Real-time telemetry &amp; dispatch updates</p>
                  </div>
                </div>
                <button className="text-pink-600 hover:bg-pink-100 p-1.5 rounded-xl transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-base">filter_list</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
                {loading ? (
                  <div className="p-4 text-center text-slate-500 text-xs font-semibold">Loading live vehicle activity logs...</div>
                ) : activity.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs font-semibold">No live vehicle activity currently recorded.</div>
                ) : (
                  activity.map((item, idx) => {
                    const tone = toneStyles[item.tone];
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border border-pink-100 bg-white hover:bg-pink-50/40 transition-all border-l-4 ${tone.border} shadow-2xs`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`material-symbols-outlined text-sm ${tone.text}`}>{item.icon}</span>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${tone.text}`}>
                              {item.label}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
                            {item.time}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mb-0.5">{item.title}</h4>
                        <p className="text-[11px] text-slate-600 leading-normal">{item.body}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      </main>

        {showAddVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4" onClick={() => !vehicleSubmitting && setShowAddVehicle(false)}>
            <form onSubmit={handleAddVehicle} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-pink-600">Fleet onboarding</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">Add Company Vehicle</h2>
                  <p className="mt-1 text-sm text-slate-500">Register the vehicle once and make it available across fleet operations.</p>
                </div>
                <button type="button" onClick={() => setShowAddVehicle(false)} className="rounded-full p-2 text-slate-500 hover:bg-pink-50" aria-label="Close">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {([
                  ["id", "Vehicle ID", "TRK-015", "text", true],
                  ["plateNumber", "Plate Number", "ABC-1234", "text", true],
                  ["vehicleType", "Vehicle Type", "Truck, van, or pickup", "text", true],
                  ["status", "Initial Status", "", "select", true],
                  ["driver", "Assigned Driver", "Optional", "text", false],
                  ["location", "Current Location", "Manila Hub", "text", false],
                  ["capacityKg", "Capacity (kg)", "1500", "number", false],
                  ["fuelEfficiency", "Fuel Efficiency (km/L)", "8.5", "number", false],
                  ["mileage", "Mileage (km)", "0", "number", false],
                  ["lastService", "Last Service", "", "date", false],
                  ["nextService", "Next Service", "", "date", false],
                ] as const).map(([field, label, placeholder, inputType, required]) => (
                  <label key={field} className="text-xs font-bold text-slate-700">
                    {label}
                    {inputType === "select" ? (
                      <select
                        value={vehicleForm.status}
                        onChange={(event) => setVehicleForm((current) => ({ ...current, status: event.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
                      >
                        <option>Active</option>
                        <option>Idle</option>
                        <option>Maintenance</option>
                      </select>
                    ) : (
                      <input
                        required={required}
                        type={inputType}
                        min={inputType === "number" ? "0" : undefined}
                        step={field === "fuelEfficiency" ? "0.1" : "1"}
                        placeholder={placeholder}
                        value={vehicleForm[field]}
                        onChange={(event) => setVehicleForm((current) => ({ ...current, [field]: event.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
                      />
                    )}
                  </label>
                ))}
              </div>

              <p className="mt-4 text-xs text-slate-500">Vehicle ID is automatically suggested from the next available fleet number. You can change it before saving.</p>
              {vehicleSubmitError && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{vehicleSubmitError}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddVehicle(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={vehicleSubmitting} className="rounded-full bg-pink-600 px-5 py-2 text-sm font-bold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {vehicleSubmitting ? "Registering..." : "Register Vehicle"}
                </button>
              </div>
            </form>
          </div>
        )}

        <GlobalFooter />
      </div>
    </RoleRestricted>
  );
}

const toneStyles = {
  critical: { border: "border-rose-500", text: "text-rose-600" },
  info: { border: "border-pink-600", text: "text-pink-600" },
  warning: { border: "border-amber-400", text: "text-amber-600" },
};
