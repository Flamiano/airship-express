"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Calendar,
  MapPin,
  Briefcase,
  Pencil,
  Trash2,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
} from "lucide-react";
import { useShell } from "@/components/ShellContext";
import PageHeader from "@/components/PageHeader";

const CHARGE_TYPE_OPTIONS = ["per_kg", "per_container", "per_km", "flat", "per_pallet"];
const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "JPY", "CNY"];
const STATUS_OPTIONS = ["draft", "active", "expired"];
const PAGE_SIZE = 5;

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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

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
      const res = await fetch("/api/rates");
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
      const res = await fetch("/api/service-providers");
      const data = await res.json();
      setProviders(data.providers || []);
    } catch {
      // non-fatal
    }
  }

  async function fetchRoutes() {
    try {
      const res = await fetch("/api/routes");
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
      const url = editingId ? `/api/rates/${editingId}` : "/api/rates";
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this rate?")) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/rates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message || "Could not delete rate.");
        return;
      }
      fetchRates();
    } catch (err) {
      console.error("Delete rate failed:", err);
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
                    placeholder="Search rate code, route, provider..."
                    className={`w-full rounded-md border py-2.5 pl-10 pr-3 text-sm outline-none ${
                      isDark
                        ? "border-[#2C4356] bg-[#121B26] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                    }`}
                  />
                </div>
              </div>

              {filteredRates.length === 0 ? (
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
                              <td className="px-4 py-4 align-top">{rLabel || "—"}</td>
                              <td className="px-4 py-4 align-top">{r.service_providers?.name || "—"}</td>
                              <td className="px-4 py-4 align-top">{CHARGE_TYPE_LABELS[r.charge_type] || r.charge_type}</td>
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
                                    onClick={() => router.push(`/rates/${r.id}`)}
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
                                    onClick={() => handleDelete(r.id)}
                                    disabled={deletingId === r.id}
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#E2685A] transition hover:bg-[#2A1212] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Trash2 size={15} />
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
                <div className="flex flex-wrap gap-2">
                  {CHARGE_TYPE_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, charge_type: c })}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.charge_type === c
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {CHARGE_TYPE_LABELS[c]}
                    </button>
                  ))}
                </div>
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, route_id: null })}
                    className={`rounded-full px-4 py-1.5 text-sm transition ${
                      form.route_id === null
                        ? "bg-[#F2419B] text-white"
                        : isDark
                        ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                        : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                    }`}
                  >
                    None
                  </button>
                  {routesList.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setForm({ ...form, route_id: r.id })}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.route_id === r.id
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {r.route_code || r.route_name || "Unnamed route"}
                    </button>
                  ))}
                </div>
                {form.route_id && (() => {
                  const selectedRoute = routesList.find((r) => r.id === form.route_id);
                  if (!selectedRoute) return null;

                  return (
                    <div className={`mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 ${isDark ? "text-[#C7D1DA]" : "text-gray-600"}`}>
                      <div>
                        <p className={`font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}>
                          Origin
                        </p>
                        <p className="mt-0.5">{selectedRoute.origin || "—"}</p>
                      </div>
                      <div>
                        <p className={`font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}>
                          Destination
                        </p>
                        <p className="mt-0.5">{selectedRoute.destination || "—"}</p>
                      </div>
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, service_provider_id: null })}
                    className={`rounded-full px-4 py-1.5 text-sm transition ${
                      form.service_provider_id === null
                        ? "bg-[#F2419B] text-white"
                        : isDark
                        ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                        : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                    }`}
                  >
                    None
                  </button>
                  {providers.map((p) => (
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
                  ))}
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Currency
                </p>
                <div className="flex flex-wrap gap-2">
                  {CURRENCY_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, currency: c })}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.currency === c
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {CURRENCY_SYMBOLS[c]} {c}
                    </button>
                  ))}
                </div>
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
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      className={`rounded-full px-4 py-1.5 text-sm capitalize transition ${
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