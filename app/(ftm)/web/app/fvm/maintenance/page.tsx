"use client";

import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import RoleRestricted from "../../components/RoleRestricted";
import FtmProfileAvatar from "../../components/FtmProfileAvatar";

import { useMemo, useState, useEffect } from "react";
import { getDashboardSnapshot, getMaintenanceRecords } from "../../lib/api";
import { usePathname } from "next/navigation";

export default function FvmMaintenancePage() {
  const [dateSortDirection, setDateSortDirection] = useState<"asc" | "desc">("desc");
  const [wearItems, setWearItems] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tripRecords, setTripRecords] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dash, maintenanceRows] = await Promise.all([getDashboardSnapshot(), getMaintenanceRecords()]);
        const vehicles = dash.vehicles || [];
        const trips = (dash as any).trips || [];

        const wear = vehicles.length
          ? [
              { label: "Braking Systems", value: Math.round((vehicles.reduce((s: number, v: any) => s + Number(v.brake_health_pct ?? v.brake_pct ?? 80), 0) / vehicles.length)), bar: "bg-primary-container" },
              { label: "Transmission", value: Math.round((vehicles.reduce((s: number, v: any) => s + Number(v.transmission_health_pct ?? v.transmission_pct ?? 75), 0) / vehicles.length)), bar: "bg-tertiary" },
              { label: "Tire Tread", value: Math.round((vehicles.reduce((s: number, v: any) => s + Number(v.tire_health_pct ?? v.tire_pct ?? 60), 0) / vehicles.length)), bar: "bg-tertiary" },
            ]
          : [];

        const dAny = dash as any;
        const repairsList = ((dAny.maintenance as any[]) || (dAny.repairs as any[]) || []).map((r: any, i: number) => ({ id: r.id || `r-${i}`, issue: r.issue || r.description || 'Service', date: r.completed_at || r.date || '' }));

        const upcomingList = ((dAny.upcoming_services as any[]) || (dAny.scheduled_maintenance as any[]) || []).map((u: any, i: number) => ({ id: u.vehicle_id || `u-${i}`, task: u.task || u.name || 'Service', when: u.when || u.scheduled_date || 'TBD', dot: 'bg-primary-container', whenColor: 'text-error' }));

        if (mounted) {
          setWearItems(wear);
          setRepairs(repairsList);
          setUpcoming(upcomingList);
          setVehicles(vehicles);
          setMaintenanceRecords(maintenanceRows || []);
          setTripRecords(trips);
        }
      } catch (e) {
        console.warn('Failed to load maintenance snapshot', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const vehicleName = (id: string) => vehicles.find((vehicle) => String(vehicle.id) === String(id))?.name || id || "Unassigned vehicle";
  const automaticRecommendations = useMemo(() => vehicles.map((vehicle) => {
    const vehicleId = String(vehicle.id);
    const vehicleTrips = tripRecords.filter((trip) => String(trip.vehicle_id ?? trip.vehicleId ?? "") === vehicleId);
    const odometer = Number(vehicle.odometer ?? vehicle.odometer_km ?? vehicle.mileage ?? vehicle.mileage_km ?? 0);
    const lastService = maintenanceRecords
      .filter((record) => String(record.vehicle_id ?? record.vehicleId ?? "") === vehicleId)
      .sort((a, b) => new Date(b.performed_at ?? b.completed_at ?? b.created_at ?? 0).getTime() - new Date(a.performed_at ?? a.completed_at ?? a.created_at ?? 0).getTime())[0];
    const serviceMileage = Number(lastService?.mileage ?? lastService?.odometer ?? 0);
    const milesSinceService = Math.max(0, odometer - serviceMileage);
    const tripsSinceService = lastService ? vehicleTrips.filter((trip) => new Date(trip.created_at ?? trip.createdAt ?? 0) > new Date(lastService.performed_at ?? lastService.completed_at ?? lastService.created_at ?? 0)).length : vehicleTrips.length;
    const mileageDue = odometer > 0 && milesSinceService >= 5000;
    const tripDue = tripsSinceService >= 50;
    if (!mileageDue && !tripDue) return null;
    return { id: `auto-${vehicleId}`, vehicle_id: vehicleId, vehicleLabel: vehicle.name || vehicleId, title: mileageDue ? "Preventive service by mileage" : "Preventive service by trip frequency", type: "Preventive", status: "due", dueDate: null, cost: 0, notes: `${milesSinceService.toLocaleString()} mileage units since service · ${tripsSinceService} trips since service`, automatic: true };
  }).filter(Boolean), [maintenanceRecords, tripRecords, vehicles]);
  const normalizedRecords = useMemo(() => [...automaticRecommendations, ...maintenanceRecords.map((record) => {
    const dueDate = record.due_date || record.scheduled_date || record.next_service_date;
    const status = String(record.status || (dueDate && new Date(dueDate) < new Date() ? "overdue" : record.completed_at ? "completed" : "scheduled")).toLowerCase();
    return { ...record, vehicleLabel: vehicleName(record.vehicle_id), dueDate, status, type: record.maintenance_type || record.type || "Preventive", title: record.title || record.description || "Scheduled service", cost: Number(record.cost ?? record.estimated_cost ?? 0) };
  })], [automaticRecommendations, maintenanceRecords, vehicles]);
  const filteredRecords = useMemo(() => normalizedRecords.filter((record) => {
    const haystack = `${record.vehicleLabel} ${record.title} ${record.type}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (statusFilter === "all" || record.status === statusFilter) && (typeFilter === "all" || record.type.toLowerCase() === typeFilter.toLowerCase());
  }), [normalizedRecords, query, statusFilter, typeFilter]);
  const overdueCount = normalizedRecords.filter((record) => record.status === "overdue" || record.status === "due").length;
  const scheduledCount = normalizedRecords.filter((record) => record.status === "scheduled").length;
  const completedCount = normalizedRecords.filter((record) => record.status === "completed").length;
  const maintenanceCost = normalizedRecords.reduce((sum, record) => sum + record.cost, 0);

  const sortedRepairs = useMemo(() => {
    const direction = dateSortDirection === "asc" ? 1 : -1;
    return [...repairs].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return (dateA - dateB) * direction;
    });
  }, [dateSortDirection, repairs]);

  const toggleDateSort = () => setDateSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));

  return (
    <div>
      {/* @ts-ignore - RoleRestricted component type compatibility */}
      <RoleRestricted allowedRoles={["fleet_manager", "admin"]} hideWhenRestricted>
        <div className="flex min-h-screen flex-col bg-[#fff8fc] font-sans text-slate-800 selection:bg-pink-500 selection:text-white">
          <GlobalNavbar />
          <main className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
      <section className="relative overflow-hidden rounded-[28px] border border-white/90 bg-gradient-to-br from-white via-pink-50/55 to-pink-100/35 p-6 shadow-[14px_14px_32px_rgba(190,24,93,0.1),-8px_-8px_24px_rgba(255,255,255,0.95),inset_1px_1px_0_rgba(255,255,255,1)] backdrop-blur-md md:p-8">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-[14px] border border-pink-200/70 bg-pink-100/80 px-3.5 py-1.5 text-xs font-semibold text-pink-700 shadow-[3px_3px_8px_rgba(190,24,93,0.08),inset_1px_1px_0_rgba(255,255,255,0.8)]"><span className="material-symbols-outlined text-[16px]">build</span>Fleet Maintenance Operations</div>
        <div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">Keep every vehicle ready for the road.</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Schedule preventive service, resolve corrective work, and track maintenance cost and vehicle availability from one workspace.
          </p>
        </div>
      </div>
        </div>
      </section>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-xl font-black text-slate-900">Maintenance schedule</h2><p className="mt-1 text-sm text-slate-500">Upcoming services, overdue work, and completed service history.</p></div></div>

      <div className="rounded-[20px] border border-white/90 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-[5px_5px_12px_rgba(190,24,93,0.06),-4px_-4px_10px_rgba(255,255,255,0.9)]">Maintenance reminders update automatically from vehicle mileage, odometer readings, trip frequency, and the latest completed service.</div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Overdue", overdueCount, "error"], ["Scheduled", scheduledCount, "primary"], ["Completed", completedCount, "success"], ["Fleet vehicles", vehicles.length, "neutral"], ["Tracked cost", `₱${maintenanceCost.toLocaleString()}`, "neutral"]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-secondary">{label}</p><p className="mt-2 text-2xl font-black text-on-surface">{value}</p></div>)}
      </div>

      <section className="hidden rounded-[24px] border border-white/90 bg-white/90 p-5 shadow-[10px_10px_24px_rgba(190,24,93,0.08),-6px_-6px_18px_rgba(255,255,255,0.95),inset_1px_1px_0_rgba(255,255,255,1)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-title-md text-title-md text-on-surface">Maintenance schedule and service history</h2><p className="text-sm text-secondary">Search vehicles, filter service type and track due dates, costs, parts, and completion status.</p></div><div className="flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vehicle or service" className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"><option value="all">All status</option><option value="scheduled">Scheduled</option><option value="overdue">Overdue</option><option value="completed">Completed</option></select><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"><option value="all">All types</option><option>Preventive</option><option>Corrective</option><option>Inspection</option><option>Parts replacement</option></select></div></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-outline-variant text-xs uppercase tracking-wider text-secondary"><th className="px-3 py-3">Vehicle</th><th className="px-3 py-3">Service</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Due / completed</th><th className="px-3 py-3">Cost</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.id} className="border-b border-outline-variant/50"><td className="px-3 py-3 font-bold text-on-surface">{record.vehicleLabel}</td><td className="px-3 py-3 text-secondary">{record.title}<div className="text-xs text-secondary">{record.notes || record.parts || ""}</div></td><td className="px-3 py-3 text-secondary">{record.type}</td><td className="px-3 py-3 text-secondary">{record.dueDate || record.performed_at || "No date"}</td><td className="px-3 py-3 text-secondary">{record.cost ? `₱${record.cost.toLocaleString()}` : "—"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${record.status === "overdue" ? "bg-error-container text-on-error-container" : record.status === "completed" ? "bg-tertiary-container text-on-tertiary-container" : "bg-primary-container text-on-primary-container"}`}>{record.status}</span></td></tr>)}{filteredRecords.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-secondary">No maintenance records match your filters.</td></tr>}</tbody></table></div>
      </section>

      <section className="rounded-[26px] border border-white/90 bg-white/85 p-5 shadow-[10px_10px_24px_rgba(190,24,93,0.08),-6px_-6px_18px_rgba(255,255,255,0.95),inset_1px_1px_0_rgba(255,255,255,1)]">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black text-slate-900">Maintenance Schedule</h2><p className="text-sm text-slate-500">Automatically generated from vehicle trips, mileage, and odometer data.</p></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Auto Schedule</span></div>
        <div className="mt-5 space-y-4">{vehicles.map((vehicle) => { const recommendation = automaticRecommendations.find((item) => item?.vehicle_id === String(vehicle.id)); const mileage = Number(vehicle.odometer ?? vehicle.odometer_km ?? vehicle.mileage ?? vehicle.mileage_km ?? 0); const trips = tripRecords.filter((trip) => String(trip.vehicle_id ?? trip.vehicleId ?? "") === String(vehicle.id)).length; const mileageProgress = Math.min(100, Math.round((mileage % 10000) / 100)); const tripProgress = Math.min(100, Math.round((trips % 200) / 2)); return <article key={vehicle.id} className="rounded-[22px] border border-white/90 bg-white/75 p-4 shadow-[6px_6px_14px_rgba(190,24,93,0.06),-5px_-5px_12px_rgba(255,255,255,0.92)]"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900">Vehicle {vehicle.name || `#${vehicle.id}`}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{vehicle.type || "Fleet vehicle"} <span className="mx-2">|</span> Plate: {vehicle.plate_number || vehicle.plate || "Not recorded"} <span className="mx-2">|</span> Status: <span className="text-emerald-600">{vehicle.status || "In Service"}</span></p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${recommendation ? "bg-pink-100 text-pink-700" : "bg-emerald-50 text-emerald-700"}`}>{recommendation ? "Due" : "On Track"}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-[18px] border border-white bg-white/80 p-3"><p className="text-xs text-slate-500">Current mileage</p><p className="mt-2 text-xl font-black text-slate-900">{mileage ? `${mileage.toLocaleString()} km` : "No odometer"}</p><p className="mt-1 text-[11px] text-slate-400">Next service at 10,000 km</p><div className="mt-3 h-2 rounded-full bg-pink-50"><div className="h-full rounded-full bg-violet-500" style={{ width: `${mileageProgress}%` }} /></div></div><div className="rounded-[18px] border border-white bg-white/80 p-3"><p className="text-xs text-slate-500">Trips since last service</p><p className="mt-2 text-xl font-black text-slate-900">{trips} trips</p><p className="mt-1 text-[11px] text-slate-400">Next service at 200 trips</p><div className="mt-3 h-2 rounded-full bg-blue-50"><div className="h-full rounded-full bg-blue-500" style={{ width: `${tripProgress}%` }} /></div></div><div className="rounded-[18px] border border-white bg-white/80 p-3"><p className="text-xs text-slate-500">Maintenance status</p><p className="mt-2 text-xl font-black text-emerald-600">{recommendation ? "Service due" : "On Track"}</p><p className="mt-1 text-[11px] text-slate-400">{recommendation ? recommendation.title : "No immediate action required"}</p></div></div></article>; })}{vehicles.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No vehicle data available.</p>}</div>
      </section>

      <div className="hidden grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-8 flex flex-col gap-gutter">
          {/* Diagnostic Health */}
          <section className="bg-surface-container-lowest rounded border border-outline-variant p-stack-md shadow-[0px_10px_30px_rgba(0,0,0,0.04)]">
            <h2 className="font-title-md text-title-md text-on-surface mb-stack-md flex items-center gap-2">
              <span
                className="material-symbols-outlined text-primary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                health_and_safety
              </span>
              Diagnostic Health - Sorter Wear
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
              {wearItems.map((item: any) => (
                <div
                  key={item.label}
                  className="bg-surface-container-low rounded-lg p-stack-sm flex flex-col items-center justify-center relative overflow-hidden"
                >
                  <span className="font-label-sm text-label-sm text-secondary mb-2 relative z-10">{item.label}</span>
                  <div className="text-3xl font-bold text-on-surface relative z-10">{item.value}%</div>
                  <div className="w-full bg-secondary-container h-1 rounded-full mt-3 relative z-10">
                    <div className={`${item.bar} h-1 rounded-full`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Repairs Log */}
          <section className="bg-surface-container-lowest rounded border border-outline-variant p-stack-md shadow-[0px_10px_30px_rgba(0,0,0,0.04)]">
            <h2 className="font-title-md text-title-md text-on-surface mb-stack-md">Recent Repairs Log</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant font-label-sm text-label-sm text-secondary">
                    <th className="py-3 px-2 font-medium">Sorter ID</th>
                    <th className="py-3 px-2 font-medium">Issue</th>
                    <th className="py-3 px-2 font-medium">
                      <button
                        type="button"
                        onClick={toggleDateSort}
                        className="inline-flex items-center gap-2 text-label-sm font-semibold text-secondary hover:text-primary transition-colors"
                      >
                        Date Completed
                        <span className="material-symbols-outlined text-[18px]">
                          {dateSortDirection === "asc" ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                    </th>
                    <th className="py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md">
                  {sortedRepairs.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-surface-container-low transition-colors ${
                        i < sortedRepairs.length - 1 ? "border-b border-outline-variant/50" : ""
                      }`}
                    >
                      <td className="py-4 px-2 font-medium text-on-surface">{r.id}</td>
                      <td className="py-4 px-2 text-secondary">{r.issue}</td>
                      <td className="py-4 px-2 text-secondary">{r.date}</td>
                      <td className="py-4 px-2">
                        <span className="inline-flex items-center gap-1 bg-surface-variant text-on-surface-variant px-2 py-1 rounded-full font-label-sm text-label-sm">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Resolved
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Upcoming Services */}
        <div className="lg:col-span-4 flex flex-col gap-gutter">
          <section className="bg-surface-container-lowest rounded border border-outline-variant p-stack-md shadow-[0px_10px_30px_rgba(0,0,0,0.04)] h-full">
            <h2 className="font-title-md text-title-md text-on-surface mb-stack-md flex items-center justify-between">
              Upcoming Services
              <span className="bg-primary-container text-on-primary-container font-label-sm text-label-sm px-2 py-1 rounded-full">
                3 Due
              </span>
            </h2>
            <div className="space-y-stack-sm relative">
              <div className="absolute left-4 top-4 bottom-4 w-px bg-outline-variant" />
              {upcoming.map((item: any) => (
                <div key={item.id} className="relative pl-10">
                  <div
                    className={`absolute left-2 top-2 w-4 h-4 rounded-full ${item.dot} border-4 border-surface-container-lowest shadow-sm z-10`}
                  />
                  <div className="bg-surface-container-low rounded-lg p-stack-sm border border-outline-variant/30">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-label-md text-label-md text-on-surface font-bold">{item.id}</span>
                      <span className={`font-label-sm text-label-sm ${item.whenColor}`}>{item.when}</span>
                    </div>
                    <p className="font-body-md text-body-md text-secondary text-sm">{item.task}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-stack-md py-2 text-center font-label-md text-label-md text-primary hover:bg-surface-variant rounded-lg transition-colors">
              View Full Schedule
            </button>
          </section>
        </div>
      </div>
    </main>
        <GlobalFooter />
      </div>
      </RoleRestricted>
    </div>
  );
}

// Maintenance datasets are loaded from Supabase via `getDashboardSnapshot()` into `wearItems`, `repairs`, and `upcoming` state.


function SiteHeader() {
  const pathname = usePathname();
  const PRIMARY_NAV = ["Dispatch", "Fuel", "Cost Analysis", "Alerts"];
  const SUB_NAV = [
    { label: "Overview", href: "/fvm", icon: "dashboard" },
    { label: "Inventory", href: "/fvm/inventory", icon: "inventory_2" },
    { label: "4D Analytics", href: "/fvm/analytics", icon: "analytics" },
    { label: "Maintenance", href: "/fvm/maintenance", icon: "build" },
  ];

  return (
    <nav className="bg-surface-container-low border-b border-outline-variant sticky top-[64px] z-50 w-full">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex items-center gap-2 md:gap-8 h-12 overflow-x-auto no-scrollbar">
        {SUB_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={
                active
                  ? "flex items-center gap-2 h-full border-b-2 border-primary text-primary font-bold text-label-md px-2 whitespace-nowrap shrink-0"
                  : "flex items-center gap-2 h-full border-b-2 border-transparent text-on-surface-variant hover:text-primary font-medium text-label-md px-2 transition-colors whitespace-nowrap shrink-0"
              }
            >
              <span className="material-symbols-outlined text-sm" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function SiteFooter() {
  return <GlobalFooter />;
}


function Navbar() {
  const pathname = usePathname();
  const links = [
    { label: "Operations Center", path: "/dashboard", short: "Ops" },
    { label: "Alerts", path: "/alerts", short: "Alerts" },
    { label: "Cost Analysis", path: "/cost", short: "Cost" },
    { label: "Driver Performance", path: "/driver/overview", short: "Driver" },
    { label: "Fuel Management", path: "/fuel", short: "Fuel" },
    { label: "FVM", path: "/fvm", short: "FVM" },
    { label: "VRDS", path: "/vrds/dashboard", short: "VRDS" },
  ];

  return (
    <nav style={navStyles.nav} aria-label="Main navigation">
      <style dangerouslySetInnerHTML={{ __html: NAV_CSS }} />
      <div style={navStyles.navInner}>
        <a href="/dashboard" style={navStyles.brandBtn} aria-label="Go to Operations Center">
          <div style={navStyles.brandBadge}>AX</div>
          <div className="fm-brand-section" style={navStyles.logoTextGroup}>
            <span className="fm-brand-section" style={navStyles.navMark}>AIRSHIP EXPRESS</span>
            <span className="fm-brand-section" style={navStyles.navSection}>PARCEL HUB</span>
          </div>
        </a>

        <div className="fm-nav-scroll ae-scroll" style={navStyles.links}>
          {links.map((link) => {
            const isActive = pathname === link.path || pathname.startsWith(link.path + "/") || (link.path !== "/dashboard" && pathname.startsWith("/" + link.path.split("/")[1]));
            return (
              <a
                key={link.path}
                href={link.path}
                className="fm-nav-link"
                aria-current={isActive ? "page" : undefined}
                style={isActive ? { ...navStyles.link, ...navStyles.active } : navStyles.link}
              >
                <span className="fm-nav-full">{link.label}</span>
                <span className="fm-nav-short">{link.short}</span>
              </a>
            );
          })}
        </div>

        <div style={navStyles.navUser}>
          <div style={navStyles.statusPill}>
            <span style={navStyles.statusDot} />
            Live
          </div>
          <FtmProfileAvatar name="Fleet Manager" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b80049] text-sm font-black text-white" />
        </div>
      </div>
    </nav>
  );
}

const NAV_CSS = `
  .fm-nav-scroll { scrollbar-width: none; -ms-overflow-style: none; }
  .fm-nav-scroll::-webkit-scrollbar { display: none; }

  .fm-nav-link {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    transition: color 0.15s ease, background 0.15s ease;
    border-radius: 999px;
  }
  .fm-nav-link:hover:not([aria-current="page"]) {
    color: #b80049 !important;
    background: rgba(184, 0, 73, 0.06);
  }
  .fm-nav-link:focus-visible {
    outline: 2px solid #b80049;
    outline-offset: 2px;
  }

  .fm-nav-short { display: none; }
  @media (max-width: 1100px) {
    .fm-nav-full { display: none; }
    .fm-nav-short { display: inline; }
  }
  @media (max-width: 720px) {
    .fm-brand-section { display: none !important; }
  }
`;

const navStyles: Record<string, React.CSSProperties> = {
  nav: {
    position: "sticky",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    background: "rgba(255, 247, 252, 0.96)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(184, 0, 73, 0.12)",
    boxShadow: "0 8px 32px rgba(184, 0, 73, 0.08)",
    zIndex: 1101,
  },
  navInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    width: "100%",
    padding: "0.75rem 1.75rem",
    boxSizing: "border-box",
    maxWidth: "100%",
    margin: "0 auto",
  },
  brandBtn: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexShrink: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    textDecoration: "none",
  },
  brandBadge: {
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#b80049",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "0.95rem",
  },
  logoTextGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.1rem",
    textAlign: "left",
  },
  navMark: {
    fontWeight: 700,
    fontSize: "0.88rem",
    color: "#141d23",
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
  },
  navSection: {
    fontSize: "0.62rem",
    letterSpacing: "0.12em",
    color: "#b80049",
    whiteSpace: "nowrap",
  },
  links: {
    display: "flex",
    gap: "0.35rem",
    overflowX: "auto",
    whiteSpace: "nowrap",
    padding: "0.15rem",
    flex: 1,
    justifyContent: "center",
  },
  link: {
    background: "transparent",
    border: "none",
    color: "#5b6b79",
    fontSize: "0.82rem",
    fontWeight: 500,
    cursor: "pointer",
    padding: "0.45rem 0.85rem",
    flexShrink: 0,
    textDecoration: "none",
  },
  active: {
    color: "#ffffff",
    fontWeight: 600,
    background: "#b80049",
    boxShadow: "0 6px 18px rgba(184, 0, 73, 0.28)",
  },
  navUser: {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
    flexShrink: 0,
  },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
    fontSize: "0.65rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#5b6b79",
    background: "rgba(47,143,91,0.10)",
    border: "1px solid rgba(47,143,91,0.22)",
    borderRadius: 999,
    padding: "0.28rem 0.55rem",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#2f8f5b",
    boxShadow: "0 0 0 3px rgba(47,143,91,0.18)",
  },
  navAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "rgba(184, 0, 73, 0.10)",
    color: "#b80049",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.68rem",
    fontWeight: 600,
    border: "1px solid rgba(236,33,136,0.18)",
  },
};

