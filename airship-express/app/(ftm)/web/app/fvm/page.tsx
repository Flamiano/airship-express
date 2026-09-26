"use client";

import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";
import RoleRestricted from "../components/RoleRestricted";
import { SkeletonBlock } from "../components/PageSkeleton";

import { useEffect, useMemo, useState } from "react";
import { createVehicle, createVehicleDocument, getCouriers, getDashboardSnapshot, getNextVehicleId, uploadVehicleDocument } from "../lib/api";
import { getCurrentRole, hasAppPermission } from "../lib/roleAccess";
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
  vehicles?: Array<{ id?: string; courier_id?: string | null; courierId?: string | null; status?: string; plate_number?: string; fuel_level?: number | string | null; fuelLevel?: number | string | null; fuel_percentage?: number | string | null; fuelPercentage?: number | string | null; driver?: string; location?: string }>;
  trips?: Array<{ id?: string; status?: string; updated_at?: string; vehicle_id?: string; driver_id?: string; destination?: string }>;
  drivers?: Array<{ id?: string; full_name?: string | null; name?: string | null }>;
};

type CourierOption = { id: string; code?: string | null; name: string };
type VehicleDocumentDraft = {
  id: string;
  type: string;
  number: string;
  expiry: string;
  file: File | null;
};

const VEHICLE_TYPES = ["Light Truck", "Medium Truck", "Heavy Truck", "Delivery Van", "Cargo Van", "Pickup Truck", "Motorcycle", "Utility Vehicle"];
const MANUFACTURERS = ["Isuzu", "Toyota", "Mitsubishi", "Nissan", "Ford", "Hyundai", "Fuso"];
const MODELS: Record<string, string[]> = {
  Isuzu: ["N-Series", "Elf", "D-Max", "Forward"],
  Toyota: ["HiAce", "Hilux", "Dyna"],
  Mitsubishi: ["Canter", "L300", "Strada"],
  Nissan: ["Urvan", "Navara", "Cabstar"],
  Ford: ["Transit", "Ranger"],
  Hyundai: ["H-100", "Starex"],
  Fuso: ["Canter", "Rosa"],
};
const DOCUMENT_TYPES = ["Registration Certificate", "Insurance Certificate", "Inspection Certificate", "Emission Certificate", "Vehicle Permit", "Other"];

function documentStatus(expiry: string) {
  if (!expiry) return "Valid";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${expiry}T00:00:00`);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  if (date < today) return "Expired";
  if (date <= soon) return "Expiring Soon";
  return "Valid";
}

function addMonths(date: string, months: number) {
  if (!date) return "";
  const next = new Date(`${date}T00:00:00`);
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}

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

type FleetStatus = "On Route" | "Assigned" | "Maintenance" | "Available" | "Idle" | "Unknown";

function getFleetStatus(
  vehicle: { id?: string; status?: string; driver?: string },
  trips: Array<{ status?: string; vehicle_id?: string; driver_id?: string }>
): FleetStatus {
  const rawStatus = String(vehicle.status || "").trim().toLowerCase();
  const hasActiveTrip = trips.some(
    (trip) => Boolean(trip.vehicle_id && trip.driver_id) &&
      String(trip.vehicle_id) === String(vehicle.id || "") &&
      isInTransitStatus(trip.status)
  );

  if (hasActiveTrip || /in transit|transit|dispatch|scheduled|moving|en route|delayed|late/i.test(rawStatus)) return "On Route";
  if (/maintenance|service|repair|out of service|offline|unavailable/i.test(rawStatus)) return "Maintenance";
  if (/assigned|reserved|allocated/i.test(rawStatus)) return "Assigned";
  if (/available|ready|free|standby|open/i.test(rawStatus)) return "Available";
  if (/idle/i.test(rawStatus) || !rawStatus) return "Idle";
  return "Unknown";
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

function getTimeframeStart(timeframe: "Today" | "This Week" | "This Month") {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (timeframe === "This Week") start.setDate(start.getDate() - 6);
  if (timeframe === "This Month") start.setDate(start.getDate() - 29);
  return start;
}

export default function FvmOverviewPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<"Today" | "This Week" | "This Month">("Today");
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  // New Interactive Feature States
  const [quickAlertDismissed, setQuickAlertDismissed] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const [modalDragOffset, setModalDragOffset] = useState({ x: 0, y: 0 });
  const canManageFleet = hasAppPermission(getCurrentRole(), "fvm", "update");
  const canCreateVehicle = hasAppPermission(getCurrentRole(), "fvm", "create");
  const [plateStatus, setPlateStatus] = useState<"idle" | "checking" | "available" | "duplicate">("idle");
  const [documents, setDocuments] = useState<VehicleDocumentDraft[]>([
    { id: "registration", type: "Registration Certificate", number: "", expiry: "", file: null },
    { id: "insurance", type: "Insurance Certificate", number: "", expiry: "", file: null },
  ]);
  const [vehicleForm, setVehicleForm] = useState({
    id: "",
    courierId: "",
    plateNumber: "",
    vehicleType: "Delivery Van",
    manufacturer: "",
    model: "",
    year: String(new Date().getFullYear()),
    vinNumber: "",
    engineNumber: "",
    fuelType: "Diesel",
    registrationExpiry: "",
    insuranceExpiry: "",
    status: "Available",
    driver: "",
    location: "Airship Express Hub - Binondo, Manila",
    capacityKg: "1000",
    fuelEfficiency: "10",
    mileage: "0",
    lastService: "",
    nextService: "",
  });
  const [vehicleSubmitError, setVehicleSubmitError] = useState("");
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);
  const [vehicleSubmitSuccess, setVehicleSubmitSuccess] = useState("");

  const updateVehicleField = (field: keyof typeof vehicleForm, value: string) => {
    setVehicleForm((current) => ({ ...current, [field]: value }));
    if (field === "manufacturer") setVehicleForm((current) => ({ ...current, model: "" }));
  };

  const normalizePlate = (value: string) => {
    const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const letters = compact.replace(/[^A-Z]/g, "").slice(0, 3);
    const digits = compact.replace(/[^0-9]/g, "").slice(0, 3);
    return letters + (digits ? `-${digits}` : "");
  };
  const numericOnly = (value: string, allowDecimal = false) => value.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, "").replace(/(\..*)\./g, "$1");

  const handleModalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, input, select, textarea")) return;
    setIsModalDragging(true);
    setModalDragOffset({ x: event.clientX - modalPosition.x, y: event.clientY - modalPosition.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleModalPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isModalDragging) return;
    setModalPosition({ x: event.clientX - modalDragOffset.x, y: event.clientY - modalDragOffset.y });
  };

  const handleModalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsModalDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  useEffect(() => {
    const plate = normalizePlate(vehicleForm.plateNumber);
    if (!/^[A-Z]{3}-\d{3}$/.test(plate)) {
      setPlateStatus("idle");
      return;
    }
    if (!plate) {
      setPlateStatus("idle");
      return;
    }
    setPlateStatus("checking");
    const timer = window.setTimeout(async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
        const result = await fetch(`${apiBase}/api/vehicles?plate_number=${encodeURIComponent(plate)}`);
        const rows = result.ok ? await result.json() : [];
        setPlateStatus(Array.isArray(rows) && rows.some((item: any) => normalizePlate(item.plate_number || item.plate) === plate) ? "duplicate" : "available");
      } catch {
        setPlateStatus("idle");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [vehicleForm.plateNumber]);

  const handleExportReport = () => {
    const rows = [
      ["Vehicle ID", "Plate", "Status", "Trip Status", "Driver ID", "Updated At"],
      ...vehicles.map((vehicle) => {
        const activeTrip = trips.find((trip) => String(trip.vehicle_id || "") === String(vehicle.id || ""));
        return [
          vehicle.id || "",
          vehicle.plate_number || "",
          getFleetStatus(vehicle, trips),
          activeTrip?.status || "",
          activeTrip?.driver_id || "",
          activeTrip?.updated_at || "",
        ];
      }),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fleet-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

  useEffect(() => {
    getCouriers()
      .then((data) => setCouriers(Array.isArray(data) ? data : []))
      .catch((error) => console.error("Failed to load couriers:", error));
  }, []);

  const vehicles = snapshot?.vehicles ?? [];
  const trips = snapshot?.trips ?? [];
  const totalVehicles = snapshot?.counts?.vehicles ?? (vehicles.length > 0 ? vehicles.length : 0);
  const fleetStatuses = useMemo(
    () => vehicles.map((vehicle) => ({ vehicle, status: getFleetStatus(vehicle, trips) })),
    [vehicles, trips]
  );
  const activeRoutes = fleetStatuses.filter(({ status }) => status === "On Route").length;
  const maintenanceCount = fleetStatuses.filter(({ status }) => status === "Maintenance").length;
  const availableCount = fleetStatuses.filter(({ status }) => status === "Available" || status === "Idle").length;
  const idleCount = availableCount;
  const timeframeTrips = useMemo(() => {
    const start = getTimeframeStart(selectedTimeframe).getTime();
    return trips.filter((trip) => {
      const timestamp = trip.updated_at ? new Date(trip.updated_at).getTime() : NaN;
      return Number.isFinite(timestamp) && timestamp >= start;
    });
  }, [selectedTimeframe, trips]);

  const nextVehicleId = (courierId?: string) => {
    const selectedCourier = couriers.find((courier) => courier.id === courierId);
    const prefix = selectedCourier?.code?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "VH";
    const assignedVehicles = courierId
      ? vehicles.filter((vehicle) => {
          const vehicleId = String(vehicle.id || "").toUpperCase();
          const sameCourier = String(vehicle.courier_id ?? vehicle.courierId ?? "") === courierId;
          return sameCourier || vehicleId.startsWith(`${prefix}-`);
        })
      : vehicles;
    const usedIds = new Set(vehicles.map((vehicle) => String(vehicle.id || "")));
    const highestNumber = assignedVehicles.reduce((highest, vehicle) => {
      const match = String(vehicle.id || "").match(/(\d+)$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    let nextNumber = highestNumber + 1;
    let candidate = `${prefix}-${String(nextNumber).padStart(3, "0")}`;
    while (usedIds.has(candidate)) {
      nextNumber += 1;
      candidate = `${prefix}-${String(nextNumber).padStart(3, "0")}`;
    }
    return candidate;
  };

  const handleCourierChange = async (courierId: string) => {
    setVehicleForm((current) => ({ ...current, courierId, id: courierId ? "Checking..." : nextVehicleId() }));
    if (!courierId) return;

    try {
      const id = await getNextVehicleId(courierId);
      setVehicleForm((current) => current.courierId === courierId ? { ...current, id } : current);
    } catch (error) {
      setVehicleSubmitError(error instanceof Error ? error.message : "Unable to calculate the next vehicle ID.");
    }
  };

  const openAddVehicle = () => {
    setVehicleSubmitError("");
    setVehicleSubmitSuccess("");
    setRegistrationStep(1);
    setModalPosition({ x: 0, y: 0 });
    setDocuments([
      { id: "registration", type: "Registration Certificate", number: "", expiry: "", file: null },
      { id: "insurance", type: "Insurance Certificate", number: "", expiry: "", file: null },
    ]);
    setVehicleForm((current) => ({ ...current, id: nextVehicleId() }));
    setShowAddVehicle(true);
  };

  const handleAddVehicle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVehicleSubmitError("");
    if (plateStatus === "duplicate") {
      setVehicleSubmitError("This plate number is already registered.");
      setRegistrationStep(1);
      return;
    }
    if (!vehicleForm.courierId || !vehicleForm.plateNumber || !vehicleForm.vehicleType || !vehicleForm.manufacturer || !vehicleForm.model || !vehicleForm.year || !vehicleForm.capacityKg || !vehicleForm.fuelType) {
      setVehicleSubmitError("Please review the required vehicle fields.");
      setRegistrationStep(1);
      return;
    }
    setVehicleSubmitting(true);
    try {
      const submissionId = await getNextVehicleId(vehicleForm.courierId);
      if (!submissionId) throw new Error("Unable to calculate the next vehicle ID.");
      setVehicleForm((current) => ({ ...current, id: submissionId }));
      const vehicle = await createVehicle({
        id: submissionId,
        courier_id: vehicleForm.courierId || null,
        plate_number: normalizePlate(vehicleForm.plateNumber),
        vehicle_type: vehicleForm.vehicleType.trim(),
        manufacturer: vehicleForm.manufacturer.trim(),
        model: vehicleForm.model.trim(),
        year: Number(vehicleForm.year),
        vin_number: vehicleForm.vinNumber.trim().toUpperCase() || null,
        engine_number: vehicleForm.engineNumber.trim() || null,
        fuel_type: vehicleForm.fuelType,
        registration_expiry: vehicleForm.registrationExpiry || null,
        insurance_expiry: vehicleForm.insuranceExpiry || null,
        status: "Available",
        availability: "Available",
        driver: vehicleForm.driver.trim() || null,
        location: vehicleForm.location.trim() || null,
        capacity_kg: Number(vehicleForm.capacityKg),
        fuel_efficiency: vehicleForm.fuelEfficiency ? Number(vehicleForm.fuelEfficiency) : null,
        mileage: vehicleForm.mileage ? Number(vehicleForm.mileage) : null,
        last_service: vehicleForm.lastService || null,
        next_service: addMonths(vehicleForm.lastService, 3) || null,
      });
      for (const document of documents.filter((item) => item.file)) {
        const safeName = document.file!.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${vehicle.id}/${document.type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${crypto.randomUUID()}-${safeName}`;
        const bytes = new Uint8Array(await document.file!.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 8192) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        }
        await uploadVehicleDocument({
          path,
          content: btoa(binary),
          content_type: document.file!.type || "application/octet-stream",
        });
        const metadata = await createVehicleDocument({
          vehicle_id: vehicle.id,
          document_type: document.type,
          document_number: document.number.trim() || null,
          expiry_date: document.expiry || null,
          file_url: path,
          status: documentStatus(document.expiry),
        });
        if (!metadata) throw new Error(`Unable to save the ${document.type}.`);
      }
      setSnapshot((current) => current ? {
        ...current,
        vehicles: [...(current.vehicles ?? []), vehicle],
        counts: { ...current.counts, vehicles: (current.counts?.vehicles ?? vehicles.length) + 1 },
      } : current);
      setShowAddVehicle(false);
      setVehicleSubmitSuccess(`Vehicle ${vehicle.id} was added successfully.`);
      setVehicleForm((current) => ({ ...current, id: "", courierId: "", plateNumber: "", vehicleType: "Delivery Van", manufacturer: "", model: "", year: String(new Date().getFullYear()), vinNumber: "", engineNumber: "", fuelType: "Diesel", registrationExpiry: "", insuranceExpiry: "", status: "Available", driver: "", location: "Airship Express Hub - Binondo, Manila", capacityKg: "1000", fuelEfficiency: "10", mileage: "0", lastService: "", nextService: "" }));
      setDocuments([]);
    } catch (error) {
      setVehicleSubmitError(error instanceof Error ? error.message : "Unable to add vehicle.");
    } finally {
      setVehicleSubmitting(false);
    }
  };
  
  const fleetActivityTrend = useMemo(() => buildFleetActivityTrend(timeframeTrips, vehicles), [timeframeTrips, vehicles]);
  const fleetPerformanceRadar = useMemo(() => buildFleetPerformanceRadar(timeframeTrips, vehicles), [timeframeTrips, vehicles]);

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

  const fuelDistributionData = useMemo(() => {
    const ranges = [
      { range: "0-25%", min: 0, max: 25, count: 0 },
      { range: "26-50%", min: 26, max: 50, count: 0 },
      { range: "51-75%", min: 51, max: 75, count: 0 },
      { range: "76-100%", min: 76, max: 100, count: 0 },
    ];

    for (const vehicle of vehicles) {
      const fuel = Number(vehicle.fuel_level ?? vehicle.fuelLevel ?? vehicle.fuel_percentage ?? vehicle.fuelPercentage);
      if (!Number.isFinite(fuel) || fuel < 0 || fuel > 100) continue;
      const bucket = ranges.find((item) => fuel >= item.min && fuel <= item.max);
      if (bucket) bucket.count += 1;
    }

    return ranges.map(({ range, count }) => ({ range, count }));
  }, [vehicles]);

  const fuelTelemetryCount = fuelDistributionData.reduce((total, item) => total + item.count, 0);

  const activity: ActivityItem[] = trips.length > 0 ? trips.slice(0, 5).map((trip) => ({
    tone: /cancel|fail|error/i.test(trip.status || "") ? "critical" : isInTransitStatus(trip.status) ? "info" : "warning",
    icon: /cancel|fail|error/i.test(trip.status || "") ? "warning" : "route",
    label: String(trip.status || "Vehicle update").toUpperCase(),
    time: trip.updated_at ? new Date(trip.updated_at).toLocaleString() : "Recently",
    title: `Vehicle ${trip.id || "unidentified"}`,
    body: trip.vehicle_id ? `Assigned to vehicle ${trip.vehicle_id}.` : "No vehicle assignment recorded.",
  })) : [];

  return (
    // @ts-ignore - RoleRestricted's React node type conflicts with the installed React typings.
    <RoleRestricted permission={{ module: "fvm", action: "view" }} hideWhenRestricted>
      <div className="fvm-page-shell flex flex-col min-h-screen bg-gradient-to-br from-pink-50/60 via-white to-pink-100/40 text-slate-800 selection:bg-pink-600 selection:text-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
        <GlobalNavbar />

        {/* Full-Width Fluid Container */}
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        
        {/* Compact Page Header */}
        <div className="fvm-panel flex flex-col md:flex-row justify-between md:items-center gap-3 px-6 py-4 rounded-2xl dark:text-slate-100">
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
            {canManageFleet && <button
              type="button"
              aria-pressed={maintenanceMode}
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                maintenanceMode 
                  ? "bg-amber-500 text-white border-amber-600 shadow-sm" 
                  : "bg-pink-50 text-slate-700 border-pink-200 hover:bg-pink-100"
              }`}
            >
              {maintenanceMode ? "⚠️ Maint. Lockdown Active" : "🛡️ Enable Maintenance Mode"}
            </button>}

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

            {canCreateVehicle && <button
              onClick={openAddVehicle}
              className="flex items-center gap-1.5 bg-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-pink-700 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Add Vehicle
            </button>}

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
            Fleet CSV report downloaded successfully.
          </div>
        )}

        {/* Compact KPI Bento Grid (Smaller size cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="fvm-panel rounded-lg p-3 transition-colors hover:border-pink-300"
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
            
            {/* Fleet Status Distribution Chart */}
            <div className="fvm-panel rounded-2xl p-4 flex flex-col min-h-[380px]">
              <div className="flex items-center justify-between border-b border-pink-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-pink-100 text-pink-600"><span className="material-symbols-outlined text-base">bar_chart</span></span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Fleet Status Distribution</h3>
                    <p className="text-[10px] text-slate-500">Current vehicle state by live records</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{totalVehicles} units</span>
              </div>
              <div className="flex-1 min-h-[260px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fleetStatusPieData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid rgba(219,39,119,0.3)", fontSize: 11 }} />
                    <Bar dataKey="value" name="Vehicles" radius={[8, 8, 0, 0]}>
                      {fleetStatusPieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Left Grid: Status Breakdown & Fleet Health Radar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Fleet Status Pie Breakdown */}
              <div className="fvm-panel rounded-2xl p-4 flex flex-col justify-between">
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
              <div className="fvm-panel rounded-2xl p-4 flex flex-col justify-between">
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
                      {/* @ts-ignore - Recharts component type conflicts with the installed React typings. */}
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

            {/* Fleet Activity Trend Chart */}
            <div className="fvm-panel rounded-2xl p-4 flex flex-col min-h-[380px]">
              <div className="flex items-center justify-between border-b border-pink-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-rose-100 text-rose-600"><span className="material-symbols-outlined text-base">monitoring</span></span>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Fleet Activity Trend</h3>
                    <p className="text-[10px] text-slate-500">Trip activity and service load by time window</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{timeframeTrips.length} trips tracked</span>
              </div>
              <div className="flex-1 min-h-[260px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fleetActivityTrend} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                    <defs>
                      <linearGradient id="activeFleetFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#db2777" stopOpacity={0.35} /><stop offset="95%" stopColor="#db2777" stopOpacity={0} /></linearGradient>
                      <linearGradient id="maintenanceFleetFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid rgba(219,39,119,0.3)", fontSize: 11 }} />
                    <Area type="monotone" dataKey="active" name="Active trips" stroke="#db2777" fill="url(#activeFleetFill)" strokeWidth={2} />
                    <Area type="monotone" dataKey="maintenance" name="Maintenance load" stroke="#f59e0b" fill="url(#maintenanceFleetFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Right Column (5 Columns on XL): Hourly Operational Trend, Fuel Chart & Live Activity Feed */}
          <div className="xl:col-span-5 flex flex-col gap-5">
            
            {/* Hourly Operational Trend Chart */}
            <div className="fvm-panel rounded-2xl p-4 flex flex-col justify-between">
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
            <div className="fvm-panel rounded-2xl p-4 flex flex-col justify-between">
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

              <div className="relative w-full h-[130px]">
                {fuelTelemetryCount === 0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center text-xs font-semibold text-slate-500">
                    No fuel telemetry available
                  </div>
                )}
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
            <div className="fvm-feed-card rounded-2xl flex flex-col h-[280px] overflow-hidden">
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
                  <div className="space-y-3 p-4">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-12 w-full" />)}</div>
                ) : activity.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs font-semibold">No live vehicle activity currently recorded.</div>
                ) : (
                  activity.map((item, idx) => {
                    const tone = toneStyles[item.tone];
                    return (
                      <div
                        key={idx}
                        className={`fvm-feed-card p-3 rounded-xl hover:bg-pink-50/40 transition-all border-l-4 ${tone.border} shadow-2xs`}
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

        {vehicleSubmitSuccess && (
          <div className="fixed inset-x-4 top-20 z-[2147483647] mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800 shadow-2xl shadow-emerald-950/20" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600" aria-hidden="true">✓</span>
            <span>{vehicleSubmitSuccess}</span>
            </div>
            <button type="button" onClick={() => setVehicleSubmitSuccess("")} className="rounded-full p-1 text-emerald-700 hover:bg-emerald-200" aria-label="Dismiss success message"><span className="material-symbols-outlined text-base">close</span></button>
          </div>
        )}

        {showAddVehicle && (
          <div className="fixed inset-x-0 bottom-0 top-12 z-[1100] flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-6 sm:py-8 lg:top-[84px]" onClick={() => !vehicleSubmitting && setShowAddVehicle(false)}>
            <form onSubmit={handleAddVehicle} onClick={(event) => event.stopPropagation()} style={{ transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)` }} className="fvm-panel relative max-h-[calc(100vh-6rem)] w-full max-w-2xl overflow-y-auto rounded-2xl p-4 shadow-2xl transition-transform sm:max-h-[calc(100vh-7rem)] sm:p-5 lg:max-h-[calc(100vh-9rem)]">
              {vehicleSubmitting && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/90 p-6 backdrop-blur-sm" role="status" aria-live="polite">
                  <div className="flex w-full max-w-xs flex-col items-center gap-4 text-center">
                    <span className="h-12 w-12 animate-spin rounded-full border-4 border-pink-100 border-t-pink-600" aria-hidden="true" />
                    <div>
                      <p className="text-base font-black text-slate-900">Creating vehicle</p>
                      <p className="mt-1 text-sm text-slate-500">Saving vehicle details and documents...</p>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-pink-100"><span className="block h-full w-2/5 animate-pulse rounded-full bg-pink-600" /></div>
                  </div>
                </div>
              )}
              <div onPointerDown={handleModalPointerDown} onPointerMove={handleModalPointerMove} onPointerUp={handleModalPointerUp} onPointerCancel={handleModalPointerUp} className={`flex cursor-grab items-start justify-between gap-4 border-b border-slate-100 pb-3 select-none ${isModalDragging ? "cursor-grabbing" : ""}`}>
                <div><p className="text-[11px] font-black uppercase tracking-wider text-pink-600">Fleet onboarding</p><h2 className="mt-1 text-2xl font-black text-slate-900">Add New Vehicle</h2><p className="mt-1 text-sm text-slate-500">Register a vehicle into the Airship Express fleet.</p></div>
                <button type="button" onClick={() => setShowAddVehicle(false)} className="rounded-full p-2 text-slate-500 hover:bg-pink-50" aria-label="Close"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto py-3 text-[11px] font-bold text-slate-400">
                {['Vehicle', 'Specifications', 'Documents', 'Maintenance', 'Review'].map((step, index) => (
                  <button
                    type="button"
                    key={step}
                    onClick={() => setRegistrationStep(index + 1)}
                    className={`fvm-step-chip whitespace-nowrap rounded-full px-3 py-1.5 ${registrationStep === index + 1 ? 'active bg-pink-600 text-white' : ''}`}
                  >
                    {index + 1}. {step}
                  </button>
                ))}
              </div>

              {registrationStep === 1 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700">Vehicle ID<input readOnly value={vehicleForm.id} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal" /><span className="mt-1 block text-[10px] font-normal text-slate-400">Automatically generated from the courier code</span></label>
                <label className="text-xs font-bold text-slate-700">Courier *<select required value={vehicleForm.courierId} onChange={(event) => handleCourierChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal"><option value="">Select courier</option>{couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700">Plate Number *<input required value={vehicleForm.plateNumber} onChange={(event) => updateVehicleField("plateNumber", normalizePlate(event.target.value))} placeholder="ABC-234" maxLength={7} pattern="[A-Za-z]{3}-[0-9]{3}" title="Use three letters, a hyphen, and three numbers, for example ABC-234." className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal uppercase" />{plateStatus !== "idle" && <span className={`mt-1 block text-[10px] ${plateStatus === "duplicate" ? "text-rose-600" : "text-emerald-600"}`}>{plateStatus === "checking" ? "Checking plate..." : plateStatus === "duplicate" ? "This plate number is already registered." : "Plate number available"}</span>}</label>
                <label className="text-xs font-bold text-slate-700">Vehicle Type *<input required list="vehicle-types" value={vehicleForm.vehicleType} onChange={(event) => updateVehicleField("vehicleType", event.target.value)} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /><datalist id="vehicle-types">{VEHICLE_TYPES.map((item) => <option key={item} value={item} />)}</datalist></label>
                <label className="text-xs font-bold text-slate-700">Manufacturer *<input required list="vehicle-manufacturers" value={vehicleForm.manufacturer} onChange={(event) => updateVehicleField("manufacturer", event.target.value)} placeholder="Isuzu" className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /><datalist id="vehicle-manufacturers">{MANUFACTURERS.map((item) => <option key={item} value={item} />)}</datalist></label>
                <label className="text-xs font-bold text-slate-700">Model *<input required list="vehicle-models" value={vehicleForm.model} onChange={(event) => updateVehicleField("model", event.target.value)} placeholder="N-Series" className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /><datalist id="vehicle-models">{(MODELS[vehicleForm.manufacturer] || []).map((item) => <option key={item} value={item} />)}</datalist></label>
                <label className="text-xs font-bold text-slate-700">Year *<input required inputMode="numeric" type="text" min="1900" max={new Date().getFullYear()} value={vehicleForm.year} onChange={(event) => updateVehicleField("year", numericOnly(event.target.value))} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /></label>
                <label className="text-xs font-bold text-slate-700">VIN Number<input value={vehicleForm.vinNumber} onChange={(event) => updateVehicleField("vinNumber", event.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={17} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal uppercase" /></label>
              </div>}

              {registrationStep === 2 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700">Engine Number<input value={vehicleForm.engineNumber} onChange={(event) => updateVehicleField("engineNumber", event.target.value.trimStart())} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /></label>
                <label className="text-xs font-bold text-slate-700">Capacity (kg) *<input required inputMode="numeric" type="text" min="1" value={vehicleForm.capacityKg} onChange={(event) => updateVehicleField("capacityKg", numericOnly(event.target.value))} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /><span className="mt-1 block text-[10px] font-normal text-slate-400">Suggested based on the selected vehicle.</span></label>
                <label className="text-xs font-bold text-slate-700">Fuel Type *<select required value={vehicleForm.fuelType} onChange={(event) => updateVehicleField("fuelType", event.target.value)} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal"><option>Diesel</option><option>Gasoline</option><option>Hybrid</option><option>Electric</option></select></label>
                <label className="text-xs font-bold text-slate-700">Fuel Efficiency (km/L)<input inputMode="decimal" type="text" min="0" step="0.1" value={vehicleForm.fuelEfficiency} onChange={(event) => updateVehicleField("fuelEfficiency", numericOnly(event.target.value, true))} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /></label>
                <label className="text-xs font-bold text-slate-700">Current Mileage (km)<input inputMode="numeric" type="text" min="0" value={vehicleForm.mileage} onChange={(event) => updateVehicleField("mileage", numericOnly(event.target.value))} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /></label>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">Initial Fleet Status<br /><span className="mt-1 inline-block">● Available</span><span className="block text-[10px] font-normal">New vehicles are automatically registered as Available.</span></div>
              </div>}

              {registrationStep === 3 && <div className="space-y-3"><p className="text-xs text-slate-500">Documents are optional. Upload PDF, JPG, JPEG, or PNG files.</p>{documents.map((document, index) => <div key={document.id} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4"><label className="text-xs font-bold text-slate-700">Document Type<select value={document.type} onChange={(event) => setDocuments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">{DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-xs font-bold text-slate-700">Document Number<input value={document.number} onChange={(event) => setDocuments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, number: event.target.value.trimStart() } : item))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" /></label><label className="text-xs font-bold text-slate-700">Expiry Date<input type="date" value={document.expiry} onChange={(event) => setDocuments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, expiry: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" /><span className="mt-1 block text-[10px] font-normal">{documentStatus(document.expiry)}</span></label><label className="text-xs font-bold text-slate-700">Upload File<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && file.size > 10 * 1024 * 1024) { setVehicleSubmitError("File is too large."); return; } setDocuments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, file } : item)); }} className="mt-1 w-full text-xs" />{document.file && <span className="mt-1 block truncate text-[10px] text-emerald-600">✓ {document.file.name}</span>}</label></div>)}<button type="button" onClick={() => setDocuments((current) => [...current, { id: crypto.randomUUID(), type: "Inspection Certificate", number: "", expiry: "", file: null }])} className="text-xs font-bold text-pink-600">+ Add Another Document</button></div>}

              {registrationStep === 4 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">Last Service<input type="date" value={vehicleForm.lastService} onChange={(event) => updateVehicleField("lastService", event.target.value)} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /></label><label className="text-xs font-bold text-slate-700">Next Service<input readOnly value={addMonths(vehicleForm.lastService, 3)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal" /><span className="mt-1 block text-[10px] font-normal text-slate-400">Automatically calculated from the last service date.</span></label><label className="text-xs font-bold text-slate-700">Location<input value={vehicleForm.location} onChange={(event) => updateVehicleField("location", event.target.value)} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /></label><label className="text-xs font-bold text-slate-700">Registration Expiry<input type="date" value={vehicleForm.registrationExpiry} onChange={(event) => updateVehicleField("registrationExpiry", event.target.value)} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /><span className="mt-1 block text-[10px]">{documentStatus(vehicleForm.registrationExpiry)}</span></label><label className="text-xs font-bold text-slate-700">Insurance Expiry<input type="date" value={vehicleForm.insuranceExpiry} onChange={(event) => updateVehicleField("insuranceExpiry", event.target.value)} className="mt-1.5 w-full rounded-xl border border-pink-200 px-3 py-2.5 text-sm font-normal" /><span className="mt-1 block text-[10px]">{documentStatus(vehicleForm.insuranceExpiry)}</span></label></div>}

              {registrationStep === 5 && <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2"><p><b>Vehicle ID:</b> {vehicleForm.id}</p><p><b>Courier:</b> {couriers.find((courier) => courier.id === vehicleForm.courierId)?.name || "Not selected"}</p><p><b>Plate:</b> {normalizePlate(vehicleForm.plateNumber)}</p><p><b>Vehicle:</b> {vehicleForm.manufacturer} {vehicleForm.model}</p><p><b>Type:</b> {vehicleForm.vehicleType}</p><p><b>Year:</b> {vehicleForm.year}</p><p><b>Capacity:</b> {vehicleForm.capacityKg} kg</p><p><b>Fuel:</b> {vehicleForm.fuelType} · {vehicleForm.fuelEfficiency} km/L</p><p><b>Status:</b> Available</p><p><b>Documents:</b> {documents.filter((document) => document.file).length} uploaded</p></div>}

              {vehicleSubmitError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{vehicleSubmitError}</p>}
              <div className="mt-6 flex justify-between gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => registrationStep > 1 ? setRegistrationStep((step) => step - 1) : setShowAddVehicle(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{registrationStep > 1 ? "Back" : "Cancel"}</button>{registrationStep < 5 ? <button type="button" onClick={() => setRegistrationStep((step) => step + 1)} className="rounded-full bg-pink-600 px-5 py-2 text-sm font-bold text-white hover:bg-pink-700">Next</button> : <button type="submit" disabled={vehicleSubmitting || plateStatus === "duplicate"} className="rounded-full bg-pink-600 px-5 py-2 text-sm font-bold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60">{vehicleSubmitting ? "Creating Vehicle..." : "Create Vehicle"}</button>}</div>
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
