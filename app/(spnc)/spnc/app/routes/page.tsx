"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Map,
  Pencil,
  Archive,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  GripVertical,
  Search,
  Eye,
  Check,
  ChevronDown,
  Clock,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";
import LocationPicker from "../../components/LocationPicker";
import MiniRouteMap from "../../components/MiniRouteMap";

const MODES = ["Road", "Rail", "Air", "Sea", "Multimodal"];
const STATUSES = ["Active", "Planned", "Discontinued"];
const PAGE_SIZE = 5;
const GEOCODE_DELAY_MS = 800;
const ADDRESS_PREVIEW_CHARS = 45; // longer origin → destination text gets "See more"
const RECENT_SEARCHES_KEY = "routes_recent_searches";
const MAX_RECENT_SEARCHES = 5;

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

type Provider = { id: string; name: string; service_modes?: string[] | null };
type Coordinate = [number, number];
type LocationField = "origin" | "destination";
type LookupState = "idle" | "loading" | "notfound";

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
  mode_of_transport: [] as string[],
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

// "road, sea" (as saved) → ["Road", "Sea"] in the order of MODES.
function parseModes(value: string | null | undefined): string[] {
  const picked = (value ?? "")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
  return MODES.filter((m) => picked.includes(m.toLowerCase()));
}

// A provider's Service Modes (e.g. ["Road", "Sea"]) in MODES order.
function providerModes(provider: Provider | null | undefined): string[] {
  return parseModes((provider?.service_modes ?? []).join(","));
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

// ---- Cached, rate-limited geocoding --------------------------------------------------------
// OpenStreetMap's free lookup allows ~1 request/second, so table rows queue up here and results
// are remembered in the browser so each address is only ever looked up once.
const GEO_CACHE_KEY = "routes_geocode_cache_v1";
const GEO_SPACING_MS = 1100;
const geoCache = new globalThis.Map<string, Coordinate | null>();
const geoPending = new globalThis.Map<string, Promise<Coordinate | null>>();
let geoQueue: Promise<void> = Promise.resolve();
let geoCacheLoaded = false;

function loadGeoCache() {
  if (geoCacheLoaded || typeof window === "undefined") return;
  geoCacheLoaded = true;
  try {
    const stored = window.localStorage.getItem(GEO_CACHE_KEY);
    if (stored) {
      for (const [k, v] of Object.entries(JSON.parse(stored) as Record<string, Coordinate>)) geoCache.set(k, v);
    }
  } catch {
    // ignore unavailable/corrupt storage
  }
}

function saveGeoCache() {
  try {
    const found: Record<string, Coordinate> = {};
    for (const [k, v] of geoCache) if (v) found[k] = v; // don't persist misses, so they can be retried later
    window.localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(found));
  } catch {
    // ignore
  }
}

function geocodeQueued(label: string): Promise<Coordinate | null> {
  const key = label.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  loadGeoCache();
  if (geoCache.has(key)) return Promise.resolve(geoCache.get(key) ?? null);
  const pending = geoPending.get(key);
  if (pending) return pending;

  const promise = new Promise<Coordinate | null>((resolve) => {
    geoQueue = geoQueue.then(async () => {
      const position = await findLocationCoordinates(label);
      geoCache.set(key, position);
      geoPending.delete(key);
      saveGeoCache();
      resolve(position);
      await new Promise((r) => setTimeout(r, GEO_SPACING_MS));
    });
  });
  geoPending.set(key, promise);
  return promise;
}

// Google Maps directions link: origin → (transit points) → destination.
function googleMapsRouteUrl(route: Pick<RouteItem, "origin" | "destination" | "transit_points" | "mode_of_transport">) {
  const params = new URLSearchParams({ api: "1", origin: route.origin, destination: route.destination });
  if (route.transit_points?.length) params.set("waypoints", route.transit_points.join("|"));
  const modes = parseModes(route.mode_of_transport);
  if (modes.length === 1 && modes[0] === "Road") params.set("travelmode", "driving");
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// Every field is required except Notes and Transit Points.
function isFormComplete(form: typeof emptyForm, distanceKm = form.distance_km) {
  return (
    form.route_code.trim() !== "" &&
    form.route_name.trim() !== "" &&
    form.origin.trim() !== "" &&
    form.destination.trim() !== "" &&
    form.mode_of_transport.length > 0 &&
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
  if (form.service_provider_id.trim() === "") missing.push("Service Provider");
  else if (form.mode_of_transport.length === 0) missing.push("Mode of Transport (add Service Modes to this provider first)");
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
  const [locationField, setLocationField] = useState<LocationField | null>(null);
  const [locationPositions, setLocationPositions] = useState<{
    origin: Coordinate | null;
    destination: Coordinate | null;
  }>({ origin: null, destination: null });
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Rows whose origin → destination text is expanded ("See more")
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(() => new Set());
  const [providerOpen, setProviderOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");

  const selectedProvider = providers.find((p) => p.id === form.service_provider_id) || null;
  const filteredProviderOptions = providers.filter((p) =>
    p.name.toLowerCase().includes(providerSearch.trim().toLowerCase())
  );

  // Mode of Transport is fixed by the chosen provider's Service Modes.
  function selectProvider(id: string) {
    const provider = providers.find((p) => p.id === id);
    setForm((f) => ({ ...f, service_provider_id: id, mode_of_transport: providerModes(provider) }));
    setProviderOpen(false);
    setProviderSearch("");
  }

  function toggleExpanded(id: string) {
    setExpandedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Mini map: which text each saved coordinate belongs to, and the lookup status per field.
  const resolvedLabels = useRef<Record<LocationField, string>>({ origin: "", destination: "" });
  const [lookupState, setLookupState] = useState<Record<LocationField, LookupState>>({
    origin: "idle",
    destination: "idle",
  });

  function resetLocations() {
    resolvedLabels.current = { origin: "", destination: "" };
    setLocationPositions({ origin: null, destination: null });
    setLookupState({ origin: "idle", destination: "idle" });
  }

  // Look up a typed location (after a short pause in typing) so the mini map and distance update.
  function scheduleGeocode(field: LocationField, label: string) {
    const trimmed = label.trim();
    if (!trimmed) {
      resolvedLabels.current[field] = "";
      setLocationPositions((c) => ({ ...c, [field]: null }));
      setLookupState((s) => ({ ...s, [field]: "idle" }));
      return;
    }
    if (resolvedLabels.current[field] === label) return; // already located (e.g. picked on the map)

    let cancelled = false;
    setLookupState((s) => ({ ...s, [field]: "loading" }));
    const timer = setTimeout(async () => {
      const position = await geocodeQueued(trimmed);
      if (cancelled) return;
      resolvedLabels.current[field] = label;
      setLocationPositions((c) => ({ ...c, [field]: position }));
      setLookupState((s) => ({ ...s, [field]: position ? "idle" : "notfound" }));
    }, GEOCODE_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }

  useEffect(() => {
    if (!showForm) return;
    return scheduleGeocode("origin", form.origin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.origin, showForm]);

  useEffect(() => {
    if (!showForm) return;
    return scheduleGeocode("destination", form.destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.destination, showForm]);

  async function loadRoutes() {
    setLoading(true);
    const res = await fetch("/spnc/app/api/routes");
    const data = await res.json();
    setRoutes(data.routes || []);
    setLoading(false);
  }

  async function loadProviders() {
    const res = await fetch("/spnc/app/api/service-providers");
    const data = await res.json();
    setProviders(data.providers || []);
  }

  useEffect(() => {
    loadRoutes();
    loadProviders();
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {
      // ignore unavailable/corrupt storage
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setShowRecentSearches(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function persistRecentSearches(next: string[]) {
    setRecentSearches(next);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // ignore unavailable storage
    }
  }

  function addRecentSearch(term: string) {
    const deduped = [term, ...recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())];
    persistRecentSearches(deduped.slice(0, MAX_RECENT_SEARCHES));
  }

  async function runSearch(term: string = searchInput) {
    const trimmed = term.trim();
    setSearchInput(term);
    setShowRecentSearches(false);
    setSearching(true);
    try {
      await loadRoutes();
    } catch (error) {
      console.error("Search routes failed:", error);
    } finally {
      setSearchTerm(trimmed);
      setSearching(false);
    }
    if (trimmed) addRecentSearch(trimmed);
  }

  function clearSearch() {
    setSearchInput("");
    setSearchTerm("");
  }

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
    resetLocations();
    setShowForm(true);
  }

  function handleEditClick(route: RouteItem) {
    setEditingId(route.id);
    setSaveError(null);
    setShowFieldErrors(false);
    resetLocations(); // origin/destination get looked up automatically for the mini map
    setForm({
      route_code: route.route_code || "",
      route_name: route.route_name || "",
      origin: route.origin || "",
      destination: route.destination || "",
      mode_of_transport: (() => {
        const fromProvider = providerModes(providers.find((p) => p.id === route.service_provider_id));
        return fromProvider.length ? fromProvider : parseModes(route.mode_of_transport);
      })(),
      service_provider_id: route.service_provider_id || "",
      distance_km: route.distance_km?.toString() || "",
      estimated_transit_hours: route.estimated_transit_hours?.toString() || "",
      transit_points: route.transit_points || [],
      waypointInput: "",
      status: route.status ? cap(route.status) : "Active",
      notes: route.notes || "",
    });
    setShowForm(true);
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
      const url = editingId ? `/spnc/app/api/routes/${editingId}` : "/spnc/app/api/routes";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_code: form.route_code,
          route_name: form.route_name,
          origin: form.origin,
          destination: form.destination,
          mode_of_transport: form.mode_of_transport.map((m) => m.toLowerCase()).join(", "),
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
      resetLocations();
      setShowForm(false);
      await loadRoutes();
    } catch (error) {
      console.error("Save route failed:", error);
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this route?")) return;
    await fetch(`/spnc/app/api/routes/${id}`, { method: "DELETE" });
    loadRoutes();
  }

  function closeForm() {
    setShowForm(false);
    setProviderOpen(false);
    setStatusOpen(false);
    setEditingId(null);
    setLocationField(null);
    resetLocations();
    setSaveError(null);
    setShowFieldErrors(false);
    setForm(emptyForm);
  }

  function selectLocation(label: string, position: Coordinate) {
    if (!locationField) return;
    const selectedField = locationField;
    resolvedLabels.current[selectedField] = label; // skip re-lookup; we already have the exact point
    setForm((current) => ({ ...current, [selectedField]: label }));
    setLocationPositions((current) => ({ ...current, [selectedField]: position }));
    setLookupState((s) => ({ ...s, [selectedField]: "idle" }));
    setLocationField(null);
  }

  // Returns the border classes for a text/number input: red if flagged empty, otherwise the normal theme border.
  function fieldBorderClass(value: string) {
    if (showFieldErrors && !value.trim()) {
      return "border-[#E2685A] focus:border-[#E2685A]";
    }
    return isDark ? "border-[#2C4356] focus:border-[#F2419B]" : "border-gray-300 focus:border-[#F2419B]";
  }

  const mutedText = isDark ? "text-[#8FA0AF]" : "text-gray-500";

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
          <p className={`text-sm ${mutedText}`}>No routes yet. Add your first one.</p>
        ) : pageLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="relative w-full max-w-md" ref={searchWrapperRef}>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      if (!e.target.value.trim()) setSearchTerm("");
                    }}
                    onFocus={() => setShowRecentSearches(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        runSearch();
                      } else if (event.key === "Escape") {
                        setShowRecentSearches(false);
                      }
                    }}
                    placeholder="Search routes, providers, cities..."
                    className={`w-full rounded-md border py-2.5 pl-3 pr-20 text-sm outline-none ${
                      isDark
                        ? "border-[#2C4356] bg-[#121B26] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    {searchInput && (
                      <button type="button" onClick={clearSearch} aria-label="Clear search" title="Clear" className={`flex h-7 w-7 items-center justify-center rounded-md transition ${isDark ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}>
                        <X size={15} />
                      </button>
                    )}
                    <button type="button" onClick={() => runSearch()} disabled={searching} aria-label="Search" title="Search" className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F2419B] text-white transition hover:bg-[#F55CAB] disabled:opacity-70">
                      {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    </button>
                  </div>
                  {showRecentSearches && recentSearches.length > 0 && (
                    <div className={`absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-md border shadow-lg ${isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"}`}>
                      <div className={`flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                        <span>Recent searches</span>
                        <button type="button" onMouseDown={(event) => { event.preventDefault(); persistRecentSearches([]); }} className={`normal-case ${isDark ? "text-[#8FA0AF] hover:text-[#F2F1EC]" : "text-gray-400 hover:text-gray-700"}`}>Clear</button>
                      </div>
                      <ul>
                        {recentSearches.map((term) => (
                          <li key={term}>
                            <div className={`group flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${isDark ? "text-[#C7D1DA] hover:bg-[#182230]" : "text-gray-700 hover:bg-gray-50"}`} onMouseDown={(event) => { event.preventDefault(); runSearch(term); }}>
                              <span className="flex min-w-0 items-center gap-2"><Clock size={13} className={`shrink-0 ${isDark ? "text-[#4B5A68]" : "text-gray-400"}`} /><span className="truncate">{term}</span></span>
                              <button type="button" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); persistRecentSearches(recentSearches.filter((item) => item !== term)); }} aria-label={`Remove "${term}" from recent searches`} className={`opacity-0 transition group-hover:opacity-100 ${isDark ? "text-[#4B5A68] hover:text-[#F2F1EC]" : "text-gray-300 hover:text-gray-600"}`}><X size={13} /></button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {searching ? (
                <div className="flex flex-col items-center gap-3 py-16"><Loader2 size={32} className="animate-spin text-[#F2419B]" /><p className="text-sm font-semibold text-[#F2419B]">Searching…</p></div>
              ) : filteredRoutes.length === 0 ? (
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
                          {["Route", "Mode", "Location", "Provider", "Distance", "Status", "Actions"].map((header) => (
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
                                {(() => {
                                  const text = `${r.origin} → ${r.destination}`;
                                  const isLong = text.length > ADDRESS_PREVIEW_CHARS;
                                  const isExpanded = expandedRoutes.has(r.id);
                                  return (
                                    <div className="max-w-md">
                                      <div className={`${mutedText} ${isLong && !isExpanded ? "line-clamp-1" : ""}`}>{text}</div>
                                      {isLong && (
                                        <button
                                          type="button"
                                          onClick={() => toggleExpanded(r.id)}
                                          className="mt-0.5 text-xs font-medium text-[#F2419B] hover:underline"
                                        >
                                          {isExpanded ? "See less" : "See more"}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                                {r.route_name && <div className={`text-xs ${mutedText}`}>{r.route_name}</div>}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex flex-wrap gap-1">
                                {(parseModes(r.mode_of_transport).length ? parseModes(r.mode_of_transport) : [r.mode_of_transport]).map((m) => (
                                  <span
                                    key={m}
                                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${
                                      isDark ? "border-[#2C4356] text-[#C7D1DA]" : "border-gray-300 text-gray-600"
                                    }`}
                                  >
                                    {m}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <a
                                href={googleMapsRouteUrl(r)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open ${r.route_code || r.route_name} in Google Maps`}
                                title={`Open in Google Maps\n${r.origin} → ${r.destination}`}
                                className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                                  isDark
                                    ? "text-[#F2419B] hover:bg-[#3A1229]"
                                    : "text-[#D9297E] hover:bg-[#FCE4F1]"
                                }`}
                              >
                                <MapPin size={17} />
                              </a>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 align-top">{r.service_providers?.name || "—"}</td>
                            <td className="px-4 py-4 align-top">{r.distance_km ? `${r.distance_km} km` : "—"}</td>
                            <td className="px-4 py-4 align-top">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(r.status, isDark)}`}>
                                {cap(r.status)}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => router.push(`/spnc/app/routes/${r.id}`)}
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
                                  onClick={() => handleArchive(r.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#E2685A] transition hover:bg-[#2A1212]"
                                >
                                  <Archive size={15} />
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

                <span className={`text-sm ${mutedText}`}>
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
                  <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Route Code *</label>
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
                  <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Route Name *</label>
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
                  <label className={`mb-1 flex items-center gap-1.5 text-xs font-medium ${mutedText}`}>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1FA968] text-[9px] font-bold text-white">
                      A
                    </span>
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
                  <label className={`mb-1 flex items-center gap-1.5 text-xs font-medium ${mutedText}`}>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#F2419B] text-[9px] font-bold text-white">
                      B
                    </span>
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

              {/* Mini map preview of origin → destination */}
              <div>
                <MiniRouteMap
                  isDark={isDark}
                  origin={locationPositions.origin}
                  destination={locationPositions.destination}
                  originLabel={form.origin}
                  destinationLabel={form.destination}
                  loading={lookupState.origin === "loading" || lookupState.destination === "loading"}
                />
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                  <div className="space-y-0.5">
                    {(["origin", "destination"] as LocationField[]).map((field) =>
                      lookupState[field] === "notfound" ? (
                        <p key={field} className="text-[#E2685A]">
                          Couldn&apos;t find “{form[field]}”. Use the pin button to pick the {field} on the map.
                        </p>
                      ) : null
                    )}
                  </div>
                  {calculatedDistance && (
                    <span className={mutedText}>
                      Straight-line distance: <span className="font-semibold text-[#F2419B]">{Number(calculatedDistance).toLocaleString()} km</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="relative">
                <p
                  className={`mb-2 text-xs font-medium tracking-wide uppercase ${
                    showFieldErrors && !form.service_provider_id.trim() ? "text-[#E2685A]" : mutedText
                  }`}
                >
                  Service Provider *
                </p>
                {providers.length === 0 ? (
                  <p className={`text-xs ${mutedText}`}>No providers yet — create one in Service Providers first.</p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusOpen(false);
                        setProviderSearch("");
                        setProviderOpen((o) => !o);
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={providerOpen}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left outline-none ${
                        showFieldErrors && !form.service_provider_id.trim()
                          ? "border-[#E2685A]"
                          : providerOpen
                          ? "border-[#F2419B]"
                          : isDark
                          ? "border-[#2C4356]"
                          : "border-gray-300"
                      } ${isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"}`}
                    >
                      <span className={`truncate ${selectedProvider ? "" : isDark ? "text-[#4B5A68]" : "text-gray-400"}`}>
                        {selectedProvider ? selectedProvider.name : "Select a service provider"}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 transition ${providerOpen ? "rotate-180" : ""} ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}
                      />
                    </button>

                    {providerOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setProviderOpen(false)} />
                        <div
                          className={`absolute z-20 mt-1 w-full overflow-hidden rounded-md border shadow-lg ${
                            isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-300 bg-white"
                          }`}
                        >
                          <div className={`flex items-center gap-2 border-b px-3 py-2 ${isDark ? "border-[#2C4356]" : "border-gray-200"}`}>
                            <Search size={15} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Search providers…"
                              value={providerSearch}
                              onChange={(e) => setProviderSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && filteredProviderOptions[0]) {
                                  e.preventDefault();
                                  selectProvider(filteredProviderOptions[0].id);
                                } else if (e.key === "Escape") {
                                  setProviderOpen(false);
                                }
                              }}
                              className={`w-full bg-transparent text-sm outline-none ${
                                isDark ? "text-[#F2F1EC] placeholder:text-[#4B5A68]" : "text-gray-900 placeholder:text-gray-400"
                              }`}
                            />
                          </div>
                          <div role="listbox" className="max-h-56 overflow-y-auto">
                            {filteredProviderOptions.length === 0 ? (
                              <p className={`px-3 py-3 text-sm ${mutedText}`}>No providers found.</p>
                            ) : (
                              filteredProviderOptions.map((p) => {
                                const selected = form.service_provider_id === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => selectProvider(p.id)}
                                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                                      selected
                                        ? "bg-[#F2419B] text-white"
                                        : isDark
                                        ? "text-[#C7D1DA] hover:bg-[#1A2530]"
                                        : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                  >
                                    <span className="truncate">{p.name}</span>
                                    {selected && <Check size={14} className="shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Mode of Transport — fixed: comes from the selected provider's Service Modes */}
              <div>
                <p
                  className={`mb-2 text-xs font-medium tracking-wide uppercase ${
                    showFieldErrors && form.service_provider_id && form.mode_of_transport.length === 0
                      ? "text-[#E2685A]"
                      : mutedText
                  }`}
                >
                  Mode of Transport *
                </p>
                <div
                  className={`flex min-h-[46px] flex-wrap items-center gap-2 rounded-md border px-3 py-2 ${
                    showFieldErrors && form.service_provider_id && form.mode_of_transport.length === 0
                      ? "border-[#E2685A]"
                      : isDark
                      ? "border-[#2C4356] bg-[#0E1621]"
                      : "border-gray-200 bg-gray-50"
                  }`}
                  title="Set by the service provider's Service Modes"
                >
                  {!form.service_provider_id ? (
                    <span className={`text-sm ${isDark ? "text-[#4B5A68]" : "text-gray-400"}`}>
                      Select a service provider first
                    </span>
                  ) : form.mode_of_transport.length === 0 ? (
                    <span className="text-sm text-[#E2685A]">
                      This provider has no Service Modes. Add them in Service Providers.
                    </span>
                  ) : (
                    form.mode_of_transport.map((m) => (
                      <span
                        key={m}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          isDark ? "bg-[#3A1229] text-[#F2419B]" : "bg-[#FCE4F1] text-[#D9297E]"
                        }`}
                      >
                        {m}
                      </span>
                    ))
                  )}
                </div>
                {form.service_provider_id && form.mode_of_transport.length > 0 && (
                  <p className={`mt-1 text-xs ${mutedText}`}>From {selectedProvider?.name}&apos;s Service Modes</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Distance (km) *</label>
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
                  <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Transit Time (hrs) *</label>
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

              {/* Transit Points — optional */}
              <div>
                <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Transit Points</label>
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
                  <p className={`mt-2 text-xs ${isDark ? "text-[#4B5A68]" : "text-gray-400"}`}>No stops added. This is optional.</p>
                ) : (
                  <div className={`mt-3 overflow-hidden rounded-lg border ${isDark ? "border-[#2C4356]" : "border-gray-200"}`}>
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

              <div className="relative">
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${mutedText}`}>Status *</p>
                <button
                  type="button"
                  onClick={() => {
                    setProviderOpen(false);
                    setStatusOpen((o) => !o);
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={statusOpen}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left outline-none ${
                    statusOpen ? "border-[#F2419B]" : isDark ? "border-[#2C4356]" : "border-gray-300"
                  } ${isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"}`}
                >
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(form.status.toLowerCase(), isDark)}`}>
                    {form.status}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition ${statusOpen ? "rotate-180" : ""} ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}
                  />
                </button>

                {statusOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                    <div
                      role="listbox"
                      className={`absolute bottom-full z-20 mb-1 w-full overflow-hidden rounded-md border shadow-lg ${
                        isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-300 bg-white"
                      }`}
                    >
                      {STATUSES.map((s) => {
                        const selected = form.status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => {
                              setForm((f) => ({ ...f, status: s }));
                              setStatusOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                              selected
                                ? isDark
                                  ? "bg-[#1A2530]"
                                  : "bg-gray-100"
                                : isDark
                                ? "hover:bg-[#1A2530]"
                                : "hover:bg-gray-100"
                            }`}
                          >
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(s.toLowerCase(), isDark)}`}>
                              {s}
                            </span>
                            {selected && <Check size={14} className="text-[#F2419B]" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${mutedText}`}>Notes</label>
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
                <div className="border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">{saveError}</div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeForm}
                className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition ${
                  isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
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
