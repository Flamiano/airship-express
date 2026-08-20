"use client";

import GlobalFooter from "../../components/GlobalFooter";
import GlobalNavbar from "../../components/GlobalNavbar";
import RoleRestricted from "../../components/RoleRestricted";
import { createVehicle, getInventoryItems } from "../../lib/api";
import { useEffect, useMemo, useState } from "react";

const vehicleKeywords = ["vehicle", "car", "truck", "bus", "van", "motor", "engine", "tire", "brake", "battery", "filter", "sensor", "wheel", "fuel", "axle", "belt", "hose", "oil", "spark", "radiator", "shock", "lamp", "mirror", "wiper", "part", "component", "assembly", "kit", "spare"];
const vehiclePartOptions = ["Engine", "Tires", "Brakes", "Battery", "Filters", "Sensors", "Wheels", "Fuel System", "Axles", "Belts & Hoses", "Radiators", "Shock Absorbers", "Lights", "Mirrors", "Wipers", "Spare Parts"] as const;
const vehiclePartKeywordMap: Record<string, string[]> = {
  Engine: ["engine", "motor", "powertrain"],
  Tires: ["tire", "tyre"],
  Brakes: ["brake", "braking"],
  Battery: ["battery", "power cell"],
  Filters: ["filter"],
  Sensors: ["sensor", "module"],
  Wheels: ["wheel", "rim"],
  "Fuel System": ["fuel", "injector", "pump"],
  Axles: ["axle", "differential"],
  "Belts & Hoses": ["belt", "hose"],
  Radiators: ["radiator", "coolant"],
  "Shock Absorbers": ["shock", "strut"],
  Lights: ["lamp", "light", "headlight", "tail light"],
  Mirrors: ["mirror"],
  Wipers: ["wiper"],
  "Spare Parts": ["spare", "part", "parts", "component", "assembly", "kit"],
};
const normalizeText = (value: unknown) => String(value ?? "").toLowerCase().trim();
const isVehicleRelatedText = (value: unknown) => {
  const searchableText = normalizeText(value);
  if (!searchableText) return false;

  const hasVehicleKeyword = vehicleKeywords.some((keyword) => searchableText.includes(keyword));
  const hasPartKeyword = /\b(part|parts|component|assembly|kit|spare|module|accessory)\b/.test(searchableText);
  return hasVehicleKeyword || hasPartKeyword;
};
const getVehiclePartLabel = (value: unknown) => {
  const searchableText = normalizeText(value);
  if (!searchableText) return "Spare Parts";

  const matchedPart = Object.entries(vehiclePartKeywordMap).find(([, keywords]) => keywords.some((keyword) => searchableText.includes(keyword)));
  return matchedPart?.[0] ?? "Spare Parts";
};

type VesselStatus = "In Transit" | "Active" | "Maintenance";

interface Vessel {
  id: string;
  model: string;
  status: VesselStatus;
  energyCore: number;
  lastService: string;
  category?: string;
  stock?: number;
  health?: number;
}

export default function FvmInventoryPage() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastServiceSortDirection, setLastServiceSortDirection] = useState<"asc" | "desc">("desc");
  const [itemFilter, setItemFilter] = useState<"All Items" | "Vehicle Parts" | "Maintenance Items">("All Items");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ id: "", plateNumber: "", vehicleType: "", capacityKg: "", fuelEfficiency: "", mileage: "" });
  const [vehicleSubmitError, setVehicleSubmitError] = useState("");
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);
  const pageSize = 8;

  useEffect(() => {
    let isMounted = true;

    async function loadInventory() {
      setLoading(true);
      try {
        const inventoryItems = await getInventoryItems();
        const vehicleParts = Array.isArray(inventoryItems) ? inventoryItems : [];

        const isVehicleRelated = (item: any) => {
          const searchableText = [
            item?.vehicle_type,
            item?.model,
            item?.manufacturer,
            item?.plate_number,
            item?.status,
            item?.fuel_type,
          ]
            .map(normalizeText)
            .filter(Boolean)
            .join(" ");

          if (!searchableText) return true;
          return isVehicleRelatedText(searchableText);
        };

        const hasAnyVehicleMatch = vehicleParts.some(isVehicleRelated);
        const mappedItems = vehicleParts.filter((item: any) => isVehicleRelated(item) || !hasAnyVehicleMatch);

        const mapped: Vessel[] = mappedItems.map((item: any, index: number) => {
          const status = String(item?.status ?? item?.availability ?? "available").toLowerCase();
          let vesselStatus: VesselStatus = "Active";
          if (status.includes("transit") || status.includes("booked") || status.includes("dispatch")) {
            vesselStatus = "In Transit";
          } else if (status.includes("cancel") || status.includes("maintenance") || status.includes("out of service") || status.includes("low")) {
            vesselStatus = "Maintenance";
          }

          const lastService = item?.updated_at || item?.created_at || item?.last_service || new Date().toISOString();
          const stock = Number(item?.capacity_kg ?? item?.capacity ?? item?.mileage ?? 0);
          const health = Number(item?.utilization ?? item?.health ?? 0);

          const partLabel = getVehiclePartLabel([item?.vehicle_type, item?.model, item?.manufacturer, item?.plate_number, item?.type, item?.category].filter(Boolean).join(" "));
          const displayModel = [partLabel, item?.manufacturer, item?.model].filter(Boolean).join(" ").trim();

          return {
            id: item?.id || item?.plate_number || `INV-${index + 1}`,
            model: displayModel || "Vehicle Part",
            status: vesselStatus,
            energyCore: Number.isFinite(health) && health > 0 ? Math.min(100, Math.max(10, health)) : Math.min(100, Math.max(10, stock % 100)),
            lastService: new Date(lastService).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            category: partLabel || item?.vehicle_type || item?.type || "Spare Parts",
            stock: Number.isFinite(stock) ? stock : 0,
            health: Number.isFinite(health) && health > 0 ? health : undefined,
          };
        });

        if (isMounted) setVessels(mapped);
      } catch (error) {
        console.error("Inventory load failed", error);
        if (isMounted) setVessels([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInventory();
    return () => {
      isMounted = false;
    };
  }, []);

  const sortedVessels = useMemo(() => {
    const direction = lastServiceSortDirection === "asc" ? 1 : -1;
    return [...vessels].sort((a, b) => {
      const dateA = new Date(a.lastService).getTime();
      const dateB = new Date(b.lastService).getTime();
      return (dateA - dateB) * direction;
    });
  }, [lastServiceSortDirection, vessels]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(vessels.map((v) => v.category).filter((category): category is string => Boolean(category))));
    const options = ["All Types", ...vehiclePartOptions] as string[];
    const seen = new Set(options);
    options.push(...uniqueCategories.filter((category) => {
      const normalizedCategory = category.toLowerCase();
      if (normalizedCategory === "general" || seen.has(category)) {
        return false;
      }
      seen.add(category);
      return true;
    }));
    return options;
  }, [vessels]);

  const filteredVessels = useMemo(() => {
    return sortedVessels.filter((v) => {
      const itemMatch =
        itemFilter === "All Items"
          ? true
          : itemFilter === "Vehicle Parts"
            ? isVehicleRelatedText(`${v.category ?? ""} ${v.model ?? ""}`)
            : v.status === "Maintenance";
      const typeMatch =
        typeFilter === "All Types"
          ? true
          : vehiclePartOptions.includes(typeFilter as (typeof vehiclePartOptions)[number])
            ? (vehiclePartKeywordMap[typeFilter] ?? []).some((keyword) => `${v.category ?? ""} ${v.model ?? ""}`.toLowerCase().includes(keyword))
            : v.category?.toLowerCase() === typeFilter.toLowerCase();
      const searchText = [v.id, v.model, v.category, v.status, v.stock?.toString(), v.health?.toString()]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const searchMatch = searchText.includes(searchQuery.toLowerCase());
      return itemMatch && typeMatch && searchMatch;
    });
  }, [sortedVessels, itemFilter, typeFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemFilter, typeFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-action-menu]")) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredVessels.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedVessels = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredVessels.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredVessels, pageSize]);

  const toggleLastServiceSort = () => setLastServiceSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));

  const handleAddVehicle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVehicleSubmitError("");
    setVehicleSubmitting(true);
    try {
      await createVehicle({
        id: vehicleForm.id.trim(),
        plate_number: vehicleForm.plateNumber.trim(),
        vehicle_type: vehicleForm.vehicleType.trim(),
        capacity_kg: vehicleForm.capacityKg ? Number(vehicleForm.capacityKg) : null,
        fuel_efficiency: vehicleForm.fuelEfficiency ? Number(vehicleForm.fuelEfficiency) : null,
        mileage: vehicleForm.mileage ? Number(vehicleForm.mileage) : null,
        status: "Active",
      });
      setShowAddVehicle(false);
      setVehicleForm({ id: "", plateNumber: "", vehicleType: "", capacityKg: "", fuelEfficiency: "", mileage: "" });
      window.location.reload();
    } catch (error) {
      setVehicleSubmitError(error instanceof Error ? error.message : "Unable to add vehicle.");
    } finally {
      setVehicleSubmitting(false);
    }
  };

  // Metric Calculations for Summary Cards & Mini-Charts
  const totalCount = vessels.length;
  const vehiclePartsCount = vessels.filter((v) => isVehicleRelatedText(`${v.category ?? ""} ${v.model ?? ""}`)).length;
  const maintenanceCount = vessels.filter((v) => v.status === "Maintenance").length;
  const criticalPartsCount = vessels.filter((v) => v.energyCore < 50).length;
  const avgScanHealth = totalCount > 0 ? Math.round(vessels.reduce((acc, v) => acc + v.energyCore, 0) / totalCount) : 0;

  return (
    <RoleRestricted allowedRoles={["fleet_manager", "admin"]} hideWhenRestricted>
      <div className="flex flex-col min-h-screen bg-[#fff7fc] text-[#141d23]">
        <GlobalNavbar />

        <main className="flex-grow w-full max-w-[1600px] mx-auto px-6 md:px-10 py-8 flex flex-col gap-8">
        
        {/* Page Header & Quick Actions */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#b80049]/10 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-[#b80049]/10 text-[#b80049] material-symbols-outlined">inventory_2</span>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#141d23]"> Fleet Inventory</h1>
            </div>
            <p className="text-sm text-[#5b6b79] mt-1 ml-11">
              Real-time telemetry, operational metrics, and health analytics across active hub sectors.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-grow lg:flex-grow-0">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6b79] text-sm">search</span>
              <input
                type="text"
                placeholder="Search batch or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-[#b80049]/20 rounded-full py-2 pl-9 pr-4 text-sm text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049] w-full lg:w-64"
              />
            </div>
            <button
              onClick={() => {
                setVehicleSubmitError("");
                setShowAddVehicle(true);
              }}
              className="bg-[#b80049] text-white px-4 py-2.5 rounded-full hover:bg-[#8f0039] transition-all flex items-center justify-center gap-2 shadow-sm text-sm font-semibold"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Vehicle
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#141d23] text-white p-2.5 rounded-full hover:bg-[#b80049] transition-all flex items-center justify-center shadow-sm"
              title="Refresh Data"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
            </button>
          </div>
        </div>

        {/* Analytics & Metrics Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#b80049]/10 shadow-[0_4px_20px_rgba(184,0,73,0.03)] flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-[#5b6b79] uppercase tracking-wider">Vehicle Parts</span>
              <h3 className="text-2xl font-bold text-[#141d23] mt-1">{vehiclePartsCount}</h3>
              <span className="text-xs text-emerald-600 font-medium mt-1 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Parts in inventory
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined">settings_suggest</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#b80049]/10 shadow-[0_4px_20px_rgba(184,0,73,0.03)] flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-[#5b6b79] uppercase tracking-wider">Maintenance Items</span>
              <h3 className="text-2xl font-bold text-[#141d23] mt-1">{maintenanceCount}</h3>
              <span className="text-xs text-[#b80049] font-medium mt-1 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#b80049] animate-pulse"></span> Awaiting service
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#b80049]/10 text-[#b80049] flex items-center justify-center">
              <span className="material-symbols-outlined">build</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#b80049]/10 shadow-[0_4px_20px_rgba(184,0,73,0.03)] flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-[#5b6b79] uppercase tracking-wider">Critical Components</span>
              <h3 className="text-2xl font-bold text-[#141d23] mt-1">{criticalPartsCount}</h3>
              <span className="text-xs text-amber-600 font-medium mt-1 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Low health parts
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined">warning</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#b80049]/10 shadow-[0_4px_20px_rgba(184,0,73,0.03)] flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-[#5b6b79] uppercase tracking-wider">Avg Part Health</span>
              <h3 className="text-2xl font-bold text-[#141d23] mt-1">{avgScanHealth}%</h3>
              <div className="w-28 h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-[#b80049] rounded-full" style={{ width: `${avgScanHealth}%` }}></div>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#b80049]/10 text-[#b80049] flex items-center justify-center">
              <span className="material-symbols-outlined">bolt</span>
            </div>
          </div>
        </div>

        {/* Filters and Table Section */}
        <div className="bg-white border border-[#b80049]/15 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(184,0,73,0.04)]">
          
          {/* Table Filters Bar */}
          <div className="p-4 bg-white border-b border-[#b80049]/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#5b6b79] uppercase tracking-wider">Filter By:</span>
              <div className="relative">
                <select
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value as typeof itemFilter)}
                  className="appearance-none bg-[#fff7fc] border border-[#b80049]/20 rounded-full py-1.5 pl-3 pr-8 text-xs font-medium text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049] cursor-pointer"
                >
                  <option>All Items</option>
                  <option>Vehicle Parts</option>
                  <option>Maintenance Items</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5b6b79] text-xs pointer-events-none">expand_more</span>
              </div>

              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="appearance-none bg-[#fff7fc] border border-[#b80049]/20 rounded-full py-1.5 pl-3 pr-8 text-xs font-medium text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049] cursor-pointer"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5b6b79] text-xs pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="text-xs text-[#5b6b79] font-medium">
              Showing <span className="text-[#b80049] font-bold">{filteredVessels.length}</span> of {totalCount} entries
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-[#5b6b79]">Loading inventory from Supabase…</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#fff7fc]/60 border-b border-[#b80049]/10 text-[#5b6b79] font-semibold text-xs uppercase tracking-wider">
                    <th className="p-4">SKU / ID</th>
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Health</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">
                      <button
                        type="button"
                        onClick={toggleLastServiceSort}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5b6b79] hover:text-[#b80049] transition-colors"
                      >
                        Last Service
                        <span className="material-symbols-outlined text-[16px]">
                          {lastServiceSortDirection === "asc" ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                    </th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#b80049]/5 text-sm">
                  {paginatedVessels.length > 0 ? (
                    paginatedVessels.map((v) => {
                      const icon = rowIcon[v.status];
                      const dotIcon = statusDotOrIcon[v.status];
                      return (
                        <tr key={v.id} className="hover:bg-[#fff7fc]/40 transition-colors group">
                          <td className="p-4 font-bold text-[#141d23] flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${icon.bg} ${icon.text} flex items-center justify-center shadow-xs`}>
                              <span className="material-symbols-outlined text-sm">{icon.icon}</span>
                            </div>
                            {v.id}
                          </td>
                          <td className="p-4 text-[#5b6b79] font-medium">{v.model}</td>
                          <td className="p-4 text-[#5b6b79] font-medium">{v.category ?? "General"}</td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge[v.status]}`}
                            >
                              {dotIcon.dot && <span className={`w-2 h-2 rounded-full ${dotIcon.dot}`} />}
                              {dotIcon.icon && <span className="material-symbols-outlined text-[14px]">{dotIcon.icon}</span>}
                              {v.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${v.status === "Maintenance" ? "text-rose-600" : "text-[#141d23]"}`}>
                                {v.health ?? v.energyCore}%
                              </span>
                              <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barColor[v.status]}`}
                                  style={{ width: `${v.energyCore}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-[#5b6b79] text-xs">{v.stock ?? 0}</td>
                          <td className="p-4 text-[#5b6b79] text-xs">{v.lastService}</td>
                          <td className="p-4 text-right">
                            <div className="relative inline-block" data-action-menu>
                              <button
                                type="button"
                                className="text-[#5b6b79] hover:text-[#b80049] transition-colors p-2 rounded-full hover:bg-[#fff7fc]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuId((prev) => (prev === v.id ? null : v.id));
                                }}
                              >
                                <span className="material-symbols-outlined text-base">more_vert</span>
                              </button>

                              {openMenuId === v.id && (
                                <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-[#b80049]/10 bg-white shadow-lg z-20">
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-sm text-[#141d23] hover:bg-[#fff7fc]"
                                    onClick={() => setOpenMenuId(null)}
                                  >
                                    View details
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-sm text-[#141d23] hover:bg-[#fff7fc]"
                                    onClick={() => setOpenMenuId(null)}
                                  >
                                    Edit entry
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-sm text-[#141d23] hover:bg-[#fff7fc]"
                                    onClick={() => setOpenMenuId(null)}
                                  >
                                    Mark service
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-[#5b6b79]">
                        No inventory items matched your current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-[#b80049]/10 flex items-center justify-between bg-white">
            <span className="text-[#5b6b79] text-xs">
              Showing {filteredVessels.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredVessels.length)} of {filteredVessels.length} entries
            </span>
            <div className="flex items-center gap-1.5">
              <button
                className="p-1 rounded-full hover:bg-[#fff7fc] text-[#5b6b79] transition-colors disabled:opacity-30"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  className={`w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center transition-colors ${pageNumber === currentPage ? "bg-[#b80049] text-white" : "hover:bg-[#fff7fc] text-[#5b6b79]"}`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                className="p-1 rounded-full hover:bg-[#fff7fc] text-[#5b6b79] transition-colors disabled:opacity-30"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </main>

        {showAddVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4" onClick={() => !vehicleSubmitting && setShowAddVehicle(false)}>
            <form
              onSubmit={handleAddVehicle}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#b80049]">Fleet record</p>
                  <h2 className="mt-1 text-2xl font-extrabold text-[#141d23]">Add Vehicle</h2>
                  <p className="mt-1 text-sm text-[#5b6b79]">Register a new company vehicle in the active fleet.</p>
                </div>
                <button type="button" onClick={() => setShowAddVehicle(false)} className="rounded-full p-2 text-[#5b6b79] hover:bg-[#fff7fc]" aria-label="Close">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {([
                  ["id", "Vehicle ID", "TRK-015", true],
                  ["plateNumber", "Plate Number", "ABC-1234", true],
                  ["vehicleType", "Vehicle Type", "Truck or Van", true],
                  ["capacityKg", "Capacity (kg)", "1500", false],
                  ["fuelEfficiency", "Fuel Efficiency (km/L)", "8.5", false],
                  ["mileage", "Mileage (km)", "42000", false],
                ] as const).map(([field, label, placeholder, required]) => (
                  <label key={field} className="text-sm font-semibold text-[#141d23]">
                    {label}
                    <input
                      required={required}
                      type={field === "id" || field === "plateNumber" || field === "vehicleType" ? "text" : "number"}
                      min={field === "id" || field === "plateNumber" || field === "vehicleType" ? undefined : "0"}
                      step={field === "fuelEfficiency" ? "0.1" : "1"}
                      placeholder={placeholder}
                      value={vehicleForm[field]}
                      onChange={(event) => setVehicleForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-[#b80049]/20 px-3 py-2.5 font-normal outline-none focus:border-[#b80049] focus:ring-2 focus:ring-[#b80049]/15"
                    />
                  </label>
                ))}
              </div>

              {vehicleSubmitError && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{vehicleSubmitError}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddVehicle(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-[#5b6b79] hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={vehicleSubmitting} className="rounded-full bg-[#b80049] px-5 py-2 text-sm font-semibold text-white hover:bg-[#8f0039] disabled:cursor-not-allowed disabled:opacity-60">
                  {vehicleSubmitting ? "Saving..." : "Save Vehicle"}
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

const statusBadge: Record<VesselStatus, string> = {
  "In Transit": "bg-[#b80049]/10 text-[#b80049]",
  Active: "border border-[#b80049]/20 text-[#141d23] bg-white",
  Maintenance: "bg-rose-50 text-rose-600 border border-rose-200",
};

const statusDotOrIcon: Record<VesselStatus, { dot?: string; icon?: string }> = {
  "In Transit": { dot: "bg-[#b80049] animate-pulse" },
  Active: { dot: "bg-emerald-500" },
  Maintenance: { icon: "warning" },
};

const rowIcon: Record<VesselStatus, { bg: string; text: string; icon: string }> = {
  "In Transit": { bg: "bg-[#b80049]/10", text: "text-[#b80049]", icon: "local_shipping" },
  Active: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "check_circle" },
  Maintenance: { bg: "bg-rose-50", text: "text-rose-600", icon: "build" },
};

const barColor: Record<VesselStatus, string> = {
  "In Transit": "bg-[#b80049]",
  Active: "bg-emerald-500",
  Maintenance: "bg-rose-500",
};