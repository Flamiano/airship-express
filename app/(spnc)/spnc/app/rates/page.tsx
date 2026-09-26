"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Calendar,
  MapPin,
  Briefcase,
  Pencil,
  Archive,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  Check,
  ChevronDown,
  Clock,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";

const CHARGE_TYPE_OPTIONS = ["per_kg", "per_container", "per_km", "flat", "per_pallet"];
const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "JPY", "CNY"];
const STATUS_OPTIONS = ["draft", "active", "expired"];
const PAGE_SIZE = 5;
const RECENT_SEARCHES_KEY = "rates_recent_searches";
const MAX_RECENT_SEARCHES = 5;

const CHARGE_TYPE_LABELS: Record<string, string> = {
  per_kg: "Per Kg",
  per_container: "Per Container",
  per_km: "Per Km",
  flat: "Flat",
  per_pallet: "Per Pallet",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
};

function formatMoney(currency: string, amount: number) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + " ";
  return `${symbol}${amount.toLocaleString()}`;
}

type Provider = { id: string; name: string };
type RouteItem = {
  id: string;
  route_code?: string;
  route_name?: string;
  origin?: string;
  destination?: string;
  mode_of_transport?: string;
  transit_points?: string[];
};

type Rate = {
  id: string;
  rate_code: string;
  description?: string | null;
  route_id?: string | null;
  routes?: { route_name?: string; origin?: string; destination?: string; mode_of_transport?: string } | null;
  service_provider_id?: string | null;
  service_providers?: { name: string } | null;
  charge_type: string;
  currency: string;
  base_rate: number;
  min_charge?: number | null;
  surcharge_pct?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  status: string;
  notes?: string | null;
};

const emptyForm = {
  rate_code: "",
  description: "",
  route_id: null as string | null,
  service_provider_id: null as string | null,
  charge_type: "per_kg",
  currency: "USD",
  base_rate: "",
  min_charge: "0",
  surcharge_pct: "0",
  valid_from: "",
  valid_to: "",
  status: "draft",
  notes: "",
};

function routeLabel(r: Rate["routes"]) {
  if (!r) return null;
  if (r.origin && r.destination) {
    return `${r.origin} → ${r.destination}${r.mode_of_transport ? ` (${r.mode_of_transport})` : ""}`;
  }
  return r.route_name || null;
}

const ADDRESS_PREVIEW_CHARS = 45; // longer route text gets "See more"

type DropdownOption = { value: string; label: string; hint?: string; badge?: string };

// Reusable single-select dropdown matching the Routes page style.
function Dropdown({
  options,
  value,
  onChange,
  placeholder,
  isDark,
  searchable = false,
  error = false,
  dropUp = false,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isDark: boolean;
  searchable?: boolean;
  error?: boolean;
  dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => `${o.label} ${o.hint || ""}`.toLowerCase().includes(q));

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  const label = (o: DropdownOption) =>
    o.badge ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${o.badge}`}>{o.label}</span> : o.label;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left outline-none ${
          error ? "border-[#E2685A]" : open ? "border-[#F2419B]" : isDark ? "border-[#2C4356]" : "border-gray-300"
        } ${isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"}`}
      >
        <span className={`min-w-0 truncate ${selected ? "" : isDark ? "text-[#4B5A68]" : "text-gray-400"}`}>
          {selected ? label(selected) : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 transition ${open ? "rotate-180" : ""} ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-20 w-full overflow-hidden rounded-md border shadow-lg ${dropUp ? "bottom-full mb-1" : "mt-1"} ${
              isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-300 bg-white"
            }`}
          >
            {searchable && (
              <div className={`flex items-center gap-2 border-b px-3 py-2 ${isDark ? "border-[#2C4356]" : "border-gray-200"}`}>
                <Search size={15} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filtered[0]) {
                      e.preventDefault();
                      pick(filtered[0].value);
                    } else if (e.key === "Escape") {
                      setOpen(false);
                    }
                  }}
                  className={`w-full bg-transparent text-sm outline-none ${
                    isDark ? "text-[#F2F1EC] placeholder:text-[#4B5A68]" : "text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>
            )}
            <div role="listbox" className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className={`px-3 py-3 text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>No matches.</p>
              ) : (
                filtered.map((o) => {
                  const isSelected = o.value === value;
                  return (
                    <button
                      key={o.value || "__none"}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => pick(o.value)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? isDark
                            ? "bg-[#1A2530] text-[#F2F1EC]"
                            : "bg-gray-100 text-gray-900"
                          : isDark
                          ? "text-[#C7D1DA] hover:bg-[#1A2530]"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{label(o)}</span>
                        {o.hint && (
                          <span className={`block truncate text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>{o.hint}</span>
                        )}
                      </span>
                      {isSelected && <Check size={14} className="shrink-0 text-[#F2419B]" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function RatesPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";
  const router = useRouter();

  const [rates, setRates] = useState<Rate[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [routesList, setRoutesList] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

  // Rows whose route text is expanded ("See more"), and the same toggle for the form's route details.
  const [expandedRates, setExpandedRates] = useState<Set<string>>(() => new Set());
  const [showFullRouteInfo, setShowFullRouteInfo] = useState(false);

  function toggleExpanded(id: string) {
    setExpandedRates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function statusColor(s: string) {
    switch (s) {
      case "active":
        return isDark ? { bg: "bg-[#0F2E22]", text: "text-[#3BD68A]" } : { bg: "bg-[#E1F7EC]", text: "text-[#1FA968]" };
      case "expired":
        return isDark ? { bg: "bg-[#2A1212]", text: "text-[#E2685A]" } : { bg: "bg-[#FBE4E1]", text: "text-[#D9483A]" };
      default:
        return isDark ? { bg: "bg-[#1A2530]", text: "text-[#8FA0AF]" } : { bg: "bg-gray-100", text: "text-gray-500" };
    }
  }

  async function fetchRates() {
    setLoading(true);
    try {
      const res = await fetch("/spnc/app/api/rates", { cache: "no-store" });
      const data = await res.json();
      setRates(data.rates || []);
    } catch (err) {
      console.error("Fetch rates failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProviders() {
    try {
      const res = await fetch("/spnc/app/api/service-providers", { cache: "no-store" });
      const data = await res.json();
      setProviders(data.providers || []);
    } catch {
      // non-fatal
    }
  }

  async function fetchRoutes() {
    try {
      const res = await fetch("/spnc/app/api/routes", { cache: "no-store" });
      const data = await res.json();
      setRoutesList(data.routes || []);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    fetchRates();
    fetchProviders();
    fetchRoutes();
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
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) setShowRecentSearches(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function persistRecentSearches(next: string[]) {
    setRecentSearches(next);
    try { window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
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
    try { await fetchRates(); } catch (error) { console.error("Search rates failed:", error); }
    setSearchTerm(trimmed);
    setSearching(false);
    if (trimmed) addRecentSearch(trimmed);
  }

  function clearSearch() {
    setSearchInput("");
    setSearchTerm("");
  }

  const filteredRates = rates.filter((rate) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const haystack = [
      rate.rate_code,
      rate.description,
      routeLabel(rate.routes),
      rate.service_providers?.name,
      rate.charge_type,
      rate.currency,
      rate.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filteredRates.length / PAGE_SIZE));
  const pagedRates = filteredRates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  function resetForm() {
    setForm(emptyForm);
    setShowFullRouteInfo(false);
    setEditingId(null);
    setSaveError(null);
    setShowFieldErrors(false);
  }

  function openAddModal() {
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(r: Rate) {
    setEditingId(r.id);
    setSaveError(null);
    setShowFieldErrors(false);
    setForm({
      rate_code: r.rate_code,
      description: r.description || "",
      route_id: r.route_id || null,
      service_provider_id: r.service_provider_id || null,
      charge_type: r.charge_type,
      currency: r.currency,
      base_rate: String(r.base_rate),
      min_charge: String(r.min_charge ?? 0),
      surcharge_pct: String(r.surcharge_pct ?? 0),
      valid_from: r.valid_from || "",
      valid_to: r.valid_to || "",
      status: r.status,
      notes: r.notes || "",
    });
    setModalOpen(true);
  }

  function fieldBorderClass(value: string) {
    if (showFieldErrors && !value.trim()) {
      return "border-[#E2685A] focus:border-[#E2685A]";
    }
    return isDark ? "border-[#2C4356] focus:border-[#F2419B]" : "border-gray-300 focus:border-[#F2419B]";
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  async function handleSave() {
    const missing: string[] = [];
    if (!form.rate_code.trim()) missing.push("Rate Code");
    if (!form.base_rate.trim()) missing.push("Base Rate");
    if (!form.valid_from.trim()) missing.push("Valid From");
    if (!form.valid_to.trim()) missing.push("Valid To");

    if (missing.length > 0) {
      setSaveError(`Please fill in: ${missing.join(", ")}.`);
      setShowFieldErrors(true);
      return;
    }

    setShowFieldErrors(false);

    if (form.valid_to <= form.valid_from) {
      setSaveError("Valid To must be after Valid From.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = {
      rate_code: form.rate_code,
      description: form.description,
      route_id: form.route_id,
      service_provider_id: form.service_provider_id,
      charge_type: form.charge_type,
      currency: form.currency,
      base_rate: Number(form.base_rate),
      min_charge: form.min_charge ? Number(form.min_charge) : 0,
      surcharge_pct: form.surcharge_pct ? Number(form.surcharge_pct) : 0,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      status: form.status,
      notes: form.notes,
    };

    try {
      const url = editingId ? `/spnc/app/api/rates/${editingId}` : "/spnc/app/api/rates";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message || (editingId ? "Could not update rate." : "Could not save rate."));
        return;
      }

      closeModal();
      fetchRates();
    } catch (err) {
      console.error("Save rate failed:", err);
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this rate?")) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/spnc/app/api/rates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message || "Could not archive rate.");
        return;
      }
      fetchRates();
    } catch (err) {
      console.error("Archive rate failed:", err);
      setDeleteError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<DollarSign size={20} />}
        title="Rate & Tariff Management"
        subtitle="Pricing schedules, surcharges, and tariff validity"
      />

      <div className="px-8">
        {deleteError && (
          <div className="mb-4 border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
            {deleteError}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : rates.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>No rates yet. Add your first one.</p>
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
                    onChange={(e) => { setSearchInput(e.target.value); if (!e.target.value.trim()) setSearchTerm(""); }}
                    onFocus={() => setShowRecentSearches(true)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); runSearch(); } else if (event.key === "Escape") setShowRecentSearches(false); }}
                    placeholder="Search rate code, route, provider..."
                    className={`w-full rounded-md border py-2.5 pl-3 pr-20 text-sm outline-none ${
                      isDark
                        ? "border-[#2C4356] bg-[#121B26] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    {searchInput && <button type="button" onClick={clearSearch} aria-label="Clear search" title="Clear" className={`flex h-7 w-7 items-center justify-center rounded-md transition ${isDark ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}><X size={15} /></button>}
                    <button type="button" onClick={() => runSearch()} disabled={searching} aria-label="Search" title="Search" className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F2419B] text-white transition hover:bg-[#F55CAB] disabled:opacity-70">{searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}</button>
                  </div>
                  {showRecentSearches && recentSearches.length > 0 && <div className={`absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-md border shadow-lg ${isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"}`}>
                    <div className={`flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}><span>Recent searches</span><button type="button" onMouseDown={(event) => { event.preventDefault(); persistRecentSearches([]); }} className={`normal-case ${isDark ? "text-[#8FA0AF] hover:text-[#F2F1EC]" : "text-gray-400 hover:text-gray-700"}`}>Clear</button></div>
                    <ul>{recentSearches.map((term) => <li key={term}><div className={`group flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${isDark ? "text-[#C7D1DA] hover:bg-[#182230]" : "text-gray-700 hover:bg-gray-50"}`} onMouseDown={(event) => { event.preventDefault(); runSearch(term); }}><span className="flex min-w-0 items-center gap-2"><Clock size={13} className={`shrink-0 ${isDark ? "text-[#4B5A68]" : "text-gray-400"}`} /><span className="truncate">{term}</span></span><button type="button" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); persistRecentSearches(recentSearches.filter((item) => item !== term)); }} aria-label={`Remove "${term}" from recent searches`} className={`opacity-0 transition group-hover:opacity-100 ${isDark ? "text-[#4B5A68] hover:text-[#F2F1EC]" : "text-gray-300 hover:text-gray-600"}`}><X size={13} /></button></div></li>)}</ul>
                  </div>}
                </div>
              </div>

              {searching ? (
                <div className="flex flex-col items-center gap-3 py-16"><Loader2 size={32} className="animate-spin text-[#F2419B]" /><p className="text-sm font-semibold text-[#F2419B]">Searching…</p></div>
              ) : filteredRates.length === 0 ? (
                <div
                  className={`rounded-lg border border-dashed px-4 py-10 text-center text-sm ${
                    isDark ? "border-[#2C4356] text-[#8FA0AF]" : "border-gray-300 text-gray-500"
                  }`}
                >
                  No matching rates found.
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
                          {['Rate', 'Route', 'Provider', 'Charge Type', 'Status', 'Amount', 'Actions'].map((header) => (
                            <th key={header} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={isDark ? "divide-y divide-[#23303D] text-[#C7D1DA]" : "divide-y divide-gray-200 text-gray-700"}>
                        {pagedRates.map((r) => {
                          const sc = statusColor(r.status);
                          const rLabel = routeLabel(r.routes);
                          return (
                            <tr key={r.id} className={isDark ? "bg-[#121B26] hover:bg-[#182230]" : "bg-white hover:bg-gray-50"}>
                              <td className="px-4 py-4 align-top">
                                <div className="space-y-1">
                                  <div className="font-semibold text-[#F2419B]">{r.rate_code}</div>
                                  <div className={`text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                                    {r.description || "No description"}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 align-top">
                                {rLabel ? (
                                  <div className="max-w-md">
                                    <div
                                      className={`${
                                        rLabel.length > ADDRESS_PREVIEW_CHARS && !expandedRates.has(r.id) ? "line-clamp-1" : ""
                                      }`}
                                      title={rLabel}
                                    >
                                      {rLabel}
                                    </div>
                                    {rLabel.length > ADDRESS_PREVIEW_CHARS && (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpanded(r.id)}
                                        className="mt-0.5 text-xs font-medium text-[#F2419B] hover:underline"
                                      >
                                        {expandedRates.has(r.id) ? "See less" : "See more"}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 align-top">{r.service_providers?.name || "—"}</td>
                              <td className="whitespace-nowrap px-4 py-4 align-top">{CHARGE_TYPE_LABELS[r.charge_type] || r.charge_type}</td>
                              <td className="px-4 py-4 align-top">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${sc.bg} ${sc.text}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 align-top">
                                <span className={`text-base font-bold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}>
                                  {formatMoney(r.currency, r.base_rate)}
                                </span>
                              </td>
                              <td className="px-4 py-4 align-top">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/spnc/app/rates/${r.id}`)}
                                    aria-label={`View ${r.rate_code}`}
                                    title="View rate details"
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
                                    onClick={() => openEditModal(r)}
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
                                    disabled={deletingId === r.id}
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#E2685A] transition hover:bg-[#2A1212] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Archive size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {filteredRates.length > 0 && totalPages > 1 && (
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
        onClick={openAddModal}
        aria-label="Add Rate"
        className="fixed right-8 bottom-8 z-40 flex items-center gap-2 rounded-full bg-[#F2419B] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#F2419B]/30 transition hover:bg-[#F55CAB]"
      >
        <Plus size={18} />
        Add Rate
      </button>

      {modalOpen && (
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
                {editingId ? "Edit Rate" : "New Rate"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className={isDark ? "text-[#8FA0AF] hover:text-[#F2F1EC]" : "text-gray-400 hover:text-gray-900"}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Rate Code *
                </p>
                <input
                  type="text"
                  placeholder="RAT-001"
                  value={form.rate_code}
                  onChange={(e) => setForm({ ...form, rate_code: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.rate_code)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Charge Type
                </p>
                <Dropdown
                  isDark={isDark}
                  placeholder="Select a charge type"
                  value={form.charge_type}
                  onChange={(v) => setForm((f) => ({ ...f, charge_type: v }))}
                  options={CHARGE_TYPE_OPTIONS.map((c) => ({ value: c, label: CHARGE_TYPE_LABELS[c] }))}
                />
              </div>

              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Description
                </p>
                <input
                  type="text"
                  placeholder="Standard sea freight per container"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
                    isDark
                      ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Route
                </p>
                <Dropdown
                  isDark={isDark}
                  searchable
                  placeholder="Select a route"
                  value={form.route_id ?? ""}
                  onChange={(v) => {
                    setShowFullRouteInfo(false);
                    setForm((f) => ({ ...f, route_id: v || null }));
                  }}
                  options={[
                    { value: "", label: "None" },
                    ...routesList.map((r) => ({
                      value: r.id,
                      label: r.route_code || r.route_name || "Unnamed route",
                      hint: r.origin && r.destination ? `${r.origin} → ${r.destination}` : undefined,
                    })),
                  ]}
                />
                {form.route_id && (() => {
                  const selectedRoute = routesList.find((r) => r.id === form.route_id);
                  if (!selectedRoute) return null;
                  const isLong =
                    (selectedRoute.origin || "").length > ADDRESS_PREVIEW_CHARS ||
                    (selectedRoute.destination || "").length > ADDRESS_PREVIEW_CHARS;
                  const clamp = isLong && !showFullRouteInfo ? "line-clamp-1" : "";

                  return (
                    <div className={`mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 ${isDark ? "text-[#C7D1DA]" : "text-gray-600"}`}>
                      <div className="min-w-0">
                        <p className={`font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}>
                          Origin
                        </p>
                        <p className={`mt-0.5 ${clamp}`} title={selectedRoute.origin}>{selectedRoute.origin || "—"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className={`font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}>
                          Destination
                        </p>
                        <p className={`mt-0.5 ${clamp}`} title={selectedRoute.destination}>{selectedRoute.destination || "—"}</p>
                      </div>
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => setShowFullRouteInfo((s) => !s)}
                          className="justify-self-start text-xs font-medium text-[#F2419B] hover:underline sm:col-span-2"
                        >
                          {showFullRouteInfo ? "See less" : "See more"}
                        </button>
                      )}
                      {selectedRoute.transit_points && selectedRoute.transit_points.length > 0 && (
                        <div className="sm:col-span-2">
                          <p className={`font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}>
                            Transit Points
                          </p>
                          <p className="mt-0.5 leading-relaxed">{selectedRoute.transit_points.join(" → ")}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Service Provider
                </p>
                <Dropdown
                  isDark={isDark}
                  searchable
                  placeholder="Select a service provider"
                  value={form.service_provider_id ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, service_provider_id: v || null }))}
                  options={[{ value: "", label: "None" }, ...providers.map((p) => ({ value: p.id, label: p.name }))]}
                />
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Currency
                </p>
                <Dropdown
                  isDark={isDark}
                  placeholder="Select a currency"
                  value={form.currency}
                  onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                  options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: `${CURRENCY_SYMBOLS[c]} ${c}` }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Base Rate *
                  </p>
                  <input
                    type="number"
                    placeholder="2800"
                    value={form.base_rate}
                    onChange={(e) => setForm({ ...form, base_rate: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.base_rate)} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Min Charge
                  </p>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.min_charge}
                    onChange={(e) => setForm({ ...form, min_charge: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
                      isDark
                        ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
              </div>

              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Surcharge %
                </p>
                <input
                  type="number"
                  placeholder="0"
                  value={form.surcharge_pct}
                  onChange={(e) => setForm({ ...form, surcharge_pct: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
                    isDark
                      ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Valid From *
                  </p>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.valid_from)} ${
                      isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"
                    }`}
                  />
                </div>
                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Valid To *
                  </p>
                  <input
                    type="date"
                    value={form.valid_to}
                    onChange={(e) => setForm({ ...form, valid_to: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.valid_to)} ${
                      isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Status
                </p>
                <Dropdown
                  isDark={isDark}
                  dropUp
                  placeholder="Select a status"
                  value={form.status}
                  onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  options={STATUS_OPTIONS.map((s) => {
                    const sc = statusColor(s);
                    return { value: s, label: s, badge: `${sc.bg} ${sc.text}` };
                  })}
                />
              </div>

              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Notes
                </p>
                <textarea
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`h-20 w-full resize-none rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
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
                onClick={closeModal}
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
    </div>
  );
}