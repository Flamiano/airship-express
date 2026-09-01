"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Map,
  Pencil,
  Trash2,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  GripVertical,
  Search,
  Eye,
} from "lucide-react";
import { useShell } from "@/components/ShellContext";
import PageHeader from "@/components/PageHeader";
import LocationPicker from "@/components/LocationPicker";

const MODES = ["Road", "Rail", "Air", "Sea", "Multimodal"];
const STATUSES = ["Active", "Planned", "Discontinued"];
const PAGE_SIZE = 5;

function statusStyle(status: string, isDark: boolean) {
  switch (status) {
    case "active":
      return isDark ? "bg-[#0F2E22] text-[#3BD68A]" : "bg-[#E1F7EC] text-[#1FA968]";
    case "planned":
      return isDark ? "bg-[#12203A] text-[#5B8CF2]" : "bg-[#E5EEFD] text-[#3B6FE0]";
    case "discontinued":
      return isDark ? "bg-[#2A1212] text-[#E2685A]" : "bg-[#FBE4E1] text-[#D9483A]";
    default:
      return isDark ? "bg-[#23303D] text-[#8FA0AF]" : "bg-gray-100 text-gray-500";
  }
}

type Provider = { id: string; name: string };
type Coordinate = [number, number];

type RouteItem = {
  id: string;
  route_code: string;
  route_name: string;
  origin: string;
  destination: string;
  mode_of_transport: string;
  service_provider_id: string | null;
  service_providers: { name: string } | null;
  distance_km: number | null;
  estimated_transit_hours: number | null;
  transit_points: string[];
  status: string;
  notes: string | null;
};

const emptyForm = {
  route_code: "",
  route_name: "",
  origin: "",
  destination: "",
  mode_of_transport: "Road",
  service_provider_id: "",
  distance_km: "",
  estimated_transit_hours: "",
  transit_points: [] as string[],
  waypointInput: "",
  status: "Active",
  notes: "",
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function distanceBetweenLocations(origin: Coordinate, destination: Coordinate) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(destination[0] - origin[0]);
  const longitudeDifference = toRadians(destination[1] - origin[1]);
  const originLatitude = toRadians(origin[0]);
  const destinationLatitude = toRadians(destination[0]);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDifference / 2) ** 2;

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

async function findLocationCoordinates(label: string): Promise<Coordinate | null> {
  if (!label.trim()) return null;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(label)}&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const results = await response.json();
    if (!results[0]) return null;
    return [Number(results[0].lat), Number(results[0].lon)];
  } catch (error) {
    console.error("Route location lookup failed:", error);
    return null;
  }
}

// Every field is required except Notes and Transit Points.
function isFormComplete(form: typeof emptyForm, distanceKm = form.distance_km) {
  return (
    form.route_code.trim() !== "" &&
    form.route_name.trim() !== "" &&
    form.origin.trim() !== "" &&
    form.destination.trim() !== "" &&
    form.mode_of_transport.trim() !== "" &&
    form.service_provider_id.trim() !== "" &&
    distanceKm.trim() !== "" &&
    form.estimated_transit_hours.trim() !== "" &&
    form.status.trim() !== ""
  );
}

// Returns a human readable message naming exactly which required fields are still empty.
function getMissingFieldsMessage(form: typeof emptyForm, distanceKm = form.distance_km) {
  const missing: string[] = [];

  if (form.route_code.trim() === "") missing.push("Route Code");
  if (form.route_name.trim() === "") missing.push("Route Name");
  if (form.origin.trim() === "") missing.push("Origin");
  if (form.destination.trim() === "") missing.push("Destination");
  if (form.mode_of_transport.trim() === "") missing.push("Mode of Transport");
  if (form.service_provider_id.trim() === "") missing.push("Service Provider");
  if (distanceKm.trim() === "") missing.push("Distance (km)");
  if (form.estimated_transit_hours.trim() === "") missing.push("Transit Time (hrs)");
  if (form.status.trim() === "") missing.push("Status");

  if (missing.length === 0) return null;

  return `Please fill in: ${missing.join(", ")}.`;
}

export default function RoutesPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";
  const router = useRouter();

  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locationField, setLocationField] = useState<"origin" | "destination" | null>(null);
  const [locationPositions, setLocationPositions] = useState<{
    origin: Coordinate | null;
    destination: Coordinate | null;
  }>({ origin: null, destination: null });
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  async function loadRoutes() {
    setLoading(true);
    const res = await fetch("/api/routes");
    const data = await res.json();
    setRoutes(data.routes || []);
    setLoading(false);
  }

  async function loadProviders() {
    const res = await fetch("/api/service-providers");
    const data = await res.json();
    setProviders(data.providers || []);
  }

  useEffect(() => {
    loadRoutes();
    loadProviders();
  }, []);

  const filteredRoutes = routes.filter((route) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const haystack = [
      route.route_code,
      route.route_name,
      route.origin,
      route.destination,
      route.mode_of_transport,
      route.service_providers?.name,
      route.status,
      route.transit_points?.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filteredRoutes.length / PAGE_SIZE));
  const pagedRoutes = filteredRoutes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const calculatedDistance =
    locationPositions.origin && locationPositions.destination
      ? distanceBetweenLocations(locationPositions.origin, locationPositions.destination).toString()
      : null;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  function goToPage(next: number) {
    if (next < 1 || next > totalPages || next === page) return;
    setPageLoading(true);
    setTimeout(() => {
      setPage(next);
      setPageLoading(false);
    }, 400);
  }

  function addWaypoint() {
    if (!form.waypointInput.trim()) return;
    setForm((f) => ({
      ...f,
      transit_points: [...f.transit_points, f.waypointInput.trim()],
      waypointInput: "",
    }));
  }

  function removeWaypoint(idx: number) {
    setForm((f) => ({
      ...f,
      transit_points: f.transit_points.filter((_, i) => i !== idx),
    }));
  }

  function openAddForm() {
    setEditingId(null);
    setSaveError(null);
    setShowFieldErrors(false);
    setForm(emptyForm);
    setLocationPositions({ origin: null, destination: null });
    setShowForm(true);
  }

  async function handleEditClick(route: RouteItem) {
    setEditingId(route.id);
    setSaveError(null);
    setShowFieldErrors(false);
    setLocationPositions({ origin: null, destination: null });
    setForm({
      route_code: route.route_code || "",
      route_name: route.route_name || "",
      origin: route.origin || "",
      destination: route.destination || "",
      mode_of_transport: route.mode_of_transport || "Road",
      service_provider_id: route.service_provider_id || "",
      distance_km: route.distance_km?.toString() || "",
      estimated_transit_hours: route.estimated_transit_hours?.toString() || "",
      transit_points: route.transit_points || [],
      waypointInput: "",
      status: route.status ? cap(route.status) : "Active",
      notes: route.notes || "",
    });
    setShowForm(true);

    const [origin, destination] = await Promise.all([
      findLocationCoordinates(route.origin),
      findLocationCoordinates(route.destination),
    ]);
    setLocationPositions({ origin, destination });
  }

  async function handleSave() {
    const missingMessage = getMissingFieldsMessage(form, calculatedDistance || form.distance_km);

    if (missingMessage) {
      setSaveError(missingMessage);
      setShowFieldErrors(true);
      return;
    }

    setShowFieldErrors(false);
    setSaving(true);
    setSaveError(null);

    try {
      const url = editingId ? `/api/routes/${editingId}` : "/api/routes";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_code: form.route_code,
          route_name: form.route_name,
          origin: form.origin,
          destination: form.destination,
          mode_of_transport: form.mode_of_transport.toLowerCase(),
          service_provider_id: form.service_provider_id || null,
          distance_km: (calculatedDistance || form.distance_km) ? Number(calculatedDistance || form.distance_km) : null,
          estimated_transit_hours: form.estimated_transit_hours ? Number(form.estimated_transit_hours) : null,
          transit_points: form.transit_points,
          status: form.status.toLowerCase(),
          notes: form.notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message || (editingId ? "Failed to update route." : "Failed to save route."));
        return;
      }

      setForm(emptyForm);
      setEditingId(null);
      setLocationPositions({ origin: null, destination: null });
      setShowForm(false);
      await loadRoutes();
    } catch (error) {
      console.error("Save route failed:", error);
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this route?")) return;
    await fetch(`/api/routes/${id}`, { method: "DELETE" });
    loadRoutes();
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setLocationField(null);
    setLocationPositions({ origin: null, destination: null });
    setSaveError(null);
    setShowFieldErrors(false);
    setForm(emptyForm);
  }

  function selectLocation(label: string, position: Coordinate) {
    if (!locationField) return;
    const selectedField = locationField;
    setForm((current) => ({ ...current, [selectedField]: label }));
    setLocationPositions((current) => ({ ...current, [selectedField]: position }));
    setLocationField(null);
  }

  // Returns the border classes for a text/number input: red if flagged empty, otherwise the normal theme border.
  function fieldBorderClass(value: string) {
    if (showFieldErrors && !value.trim()) {
      return "border-[#E2685A] focus:border-[#E2685A]";
    }
    return isDark ? "border-[#2C4356] focus:border-[#F2419B]" : "border-gray-300 focus:border-[#F2419B]";
  }

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<Map size={20} />}
        title="Service Network & Route Planner"
        subtitle="Define origin-destination routes and transit networks"
      />

      <div className="px-8">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : routes.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>No routes yet. Add your first one.</p>
        ) : pageLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="relative w-full max-w-md">
                  <Search
                    size={16}
                    className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                      isDark ? "text-[#8FA0AF]" : "text-gray-400"
                    }`}
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search routes, providers, cities..."
                    className={`w-full rounded-md border py-2.5 pl-10 pr-3 text-sm outline-none ${
                      isDark
                        ? "border-[#2C4356] bg-[#121B26] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                    }`}
                  />
                </div>
              </div>

              {filteredRoutes.length === 0 ? (
                <div
                  className={`rounded-lg border border-dashed px-4 py-10 text-center text-sm ${
                    isDark ? "border-[#2C4356] text-[#8FA0AF]" : "border-gray-300 text-gray-500"
                  }`}
                >
                  No matching routes found.
                </div>
              ) : (
                <div
                  className={`overflow-hidden rounded-lg border ${
                    isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#23303D] text-left">
                      <thead className={isDark ? "bg-[#0B1220] text-[#8FA0AF]" : "bg-gray-50 text-gray-500"}>
                        <tr>
                          {['Route', 'Mode', 'Provider', 'Distance', 'Status', 'Actions'].map((header) => (
                            <th key={header} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={isDark ? "divide-y divide-[#23303D] text-[#C7D1DA]" : "divide-y divide-gray-200 text-gray-700"}>
                        {pagedRoutes.map((r) => (
                          <tr key={r.id} className={isDark ? "bg-[#121B26] hover:bg-[#182230]" : "bg-white hover:bg-gray-50"}>
                            <td className="px-4 py-4 align-top">
                              <div className="space-y-1">
                                <div className="font-semibold text-[#F2419B]">{r.route_code || r.route_name}</div>
                                <div className={isDark ? "text-[#8FA0AF]" : "text-gray-500"}>
                                  {r.origin} → {r.destination}
                                </div>
                                {r.route_name && (
                                  <div className={`text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                                    {r.route_name}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${isDark ? "border-[#2C4356] text-[#C7D1DA]" : "border-gray-300 text-gray-600"}`}>
                                {r.mode_of_transport}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              {r.service_providers?.name || "—"}
                            </td>
                            <td className="px-4 py-4 align-top">
                              {r.distance_km ? `${r.distance_km} km` : "—"}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(r.status, isDark)}`}>
                                {cap(r.status)}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => router.push(`/routes/${r.id}`)}
                                  aria-label={`View ${r.route_code || r.route_name}`}
                                  title="View route details"
                                  className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                                    isDark
                                      ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]"
                                      : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                                  }`}
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(r)}
                                  className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                                    isDark
                                      ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]"
                                      : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                                  }`}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(r.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#E2685A] transition hover:bg-[#2A1212]"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {filteredRoutes.length > 0 && totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1 || pageLoading}
                  className={`flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isDark
                      ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <ChevronLeft size={16} />
                  Back
                </button>

                <span className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages || pageLoading}
                  className={`flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isDark
                      ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={openAddForm}
        aria-label="Add Route"
        className="fixed right-8 bottom-8 z-40 flex items-center gap-2 rounded-full bg-[#F2419B] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#F2419B]/30 transition hover:bg-[#F55CAB]"
      >
        <Plus size={18} />
        Add Route
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border p-6 ${
              isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
            }`}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                className={`text-xl font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {editingId ? "Edit Route" : "New Route"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className={isDark ? "text-[#8FA0AF] hover:text-[#F2F1EC]" : "text-gray-400 hover:text-gray-900"}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Route Code *
                  </label>
                  <input
                    type="text"
                    placeholder="RTE-001"
                    value={form.route_code}
                    onChange={(e) => setForm({ ...form, route_code: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.route_code)} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Route Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Shanghai-Rotterdam Sea"
                    value={form.route_name}
                    onChange={(e) => setForm({ ...form, route_name: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.route_name)} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Origin *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Shanghai, CN"
                      value={form.origin}
                      onChange={(e) => setForm({ ...form, origin: e.target.value })}
                      className={`min-w-0 flex-1 rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.origin)} ${
                        isDark
                          ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                          : "bg-white text-gray-900 placeholder:text-gray-400"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setLocationField("origin")}
                      aria-label="Pick origin on map"
                      title="Pick origin on map"
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition ${
                        isDark
                          ? "border-[#2C4356] text-[#F2419B] hover:bg-[#1A2530]"
                          : "border-gray-300 text-[#D9297E] hover:bg-[#FCE4F1]"
                      }`}
                    >
                      <MapPin size={17} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Destination *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Rotterdam, NL"
                      value={form.destination}
                      onChange={(e) => setForm({ ...form, destination: e.target.value })}
                      className={`min-w-0 flex-1 rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.destination)} ${
                        isDark
                          ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                          : "bg-white text-gray-900 placeholder:text-gray-400"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setLocationField("destination")}
                      aria-label="Pick destination on map"
                      title="Pick destination on map"
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition ${
                        isDark
                          ? "border-[#2C4356] text-[#F2419B] hover:bg-[#1A2530]"
                          : "border-gray-300 text-[#D9297E] hover:bg-[#FCE4F1]"
                      }`}
                    >
                      <MapPin size={17} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Mode of Transport *
                </p>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm({ ...form, mode_of_transport: m })}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.mode_of_transport === m
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p
                  className={`mb-2 text-xs font-medium tracking-wide uppercase ${
                    showFieldErrors && !form.service_provider_id.trim()
                      ? "text-[#E2685A]"
                      : isDark
                      ? "text-[#8FA0AF]"
                      : "text-gray-500"
                  }`}
                >
                  Service Provider *
                </p>
                <div
                  className={`flex flex-wrap gap-2 rounded-md ${
                    showFieldErrors && !form.service_provider_id.trim()
                      ? "border border-[#E2685A] p-2"
                      : ""
                  }`}
                >
                  {providers.length === 0 ? (
                    <p className={`text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                      No providers yet — create one in Service Providers first.
                    </p>
                  ) : (
                    providers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setForm({ ...form, service_provider_id: p.id })}
                        className={`rounded-full px-4 py-1.5 text-sm transition ${
                          form.service_provider_id === p.id
                            ? "bg-[#F2419B] text-white"
                            : isDark
                            ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                            : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Distance (km) *
                  </label>
                  <input
                    type="number"
                    placeholder="19500"
                    value={calculatedDistance || form.distance_km}
                    onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(
                      calculatedDistance || form.distance_km
                    )} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Transit Time (hrs) *
                  </label>
                  <input
                    type="number"
                    placeholder="720"
                    value={form.estimated_transit_hours}
                    onChange={(e) => setForm({ ...form, estimated_transit_hours: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(
                      form.estimated_transit_hours
                    )} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
              </div>

              {/* Transit Points — optional, pink theme to match the rest of the app */}
              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Transit Points
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a stop, e.g. Singapore"
                    value={form.waypointInput}
                    onChange={(e) => setForm({ ...form, waypointInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addWaypoint();
                      }
                    }}
                    className={`flex-1 rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
                      isDark
                        ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={addWaypoint}
                    className="flex items-center gap-1 rounded-md bg-[#F2419B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#F55CAB]"
                  >
                    <Plus size={15} />
                    Add
                  </button>
                </div>

                {form.transit_points.length === 0 ? (
                  <p className={`mt-2 text-xs ${isDark ? "text-[#4B5A68]" : "text-gray-400"}`}>
                    No stops added. This is optional.
                  </p>
                ) : (
                  <div
                    className={`mt-3 overflow-hidden rounded-lg border ${
                      isDark ? "border-[#2C4356]" : "border-gray-200"
                    }`}
                  >
                    {form.transit_points.map((wp, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 px-3 py-2.5 ${
                          idx !== form.transit_points.length - 1
                            ? isDark
                              ? "border-b border-[#23303D]"
                              : "border-b border-gray-100"
                            : ""
                        } ${isDark ? "bg-[#0B1220]" : "bg-gray-50"}`}
                      >
                        <GripVertical size={14} className={isDark ? "text-[#4B5A68]" : "text-gray-300"} />
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            isDark ? "bg-[#3A1229] text-[#F2419B]" : "bg-[#FCE4F1] text-[#D9297E]"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <MapPin size={13} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                        <span className={`flex-1 text-sm ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}>{wp}</span>
                        <button
                          type="button"
                          onClick={() => removeWaypoint(idx)}
                          className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                            isDark
                              ? "text-[#8FA0AF] hover:bg-[#2A1212] hover:text-[#E2685A]"
                              : "text-gray-400 hover:bg-[#FBE4E1] hover:text-[#D9483A]"
                          }`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Status *
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.status === s
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Notes
                </label>
                <textarea
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
                    isDark
                      ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              {saveError && (
                <div className="border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
                  {saveError}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeForm}
                className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition ${
                  isDark
                    ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
                    : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#F2419B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#F55CAB] disabled:cursor-not-allowed disabled:bg-[#4B5A68]"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? (editingId ? "Updating…" : "Saving…") : editingId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {locationField && (
        <LocationPicker
          isDark={isDark}
          initialLabel={form[locationField]}
          initialPosition={locationPositions[locationField]}
          otherPosition={locationPositions[locationField === "origin" ? "destination" : "origin"]}
          onSelect={selectLocation}
          onClose={() => setLocationField(null)}
        />
      )}
    </div>
  );
}