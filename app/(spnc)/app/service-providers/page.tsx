"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Star,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Eye,
} from "lucide-react";
import { useShell } from "@/components/ShellContext";
import PageHeader from "@/components/PageHeader";

const TYPES: { label: string; value: string }[] = [
  { label: "Carrier", value: "carrier" },
  { label: "Freight Forwarder", value: "freight_forwarder" },
  { label: "Customs Broker", value: "customs_broker" },
  { label: "Warehouse", value: "warehouse" },
  { label: "3PL", value: "3pl" },
];

const MODES = ["Road", "Rail", "Air", "Sea", "Multimodal"];
const STATUSES: { label: string; value: string }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];
const PAGE_SIZE = 5;

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia",
  "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad",
  "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland",
  "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait",
  "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands",
  "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
  "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia",
  "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain",
  "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania",
  "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

type Provider = {
  id: string;
  name: string;
  type: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  service_modes: string[];
  status: string;
  rating: number;
  contract_ref: string | null;
  notes: string | null;
};

const emptyForm = {
  name: "",
  type: TYPES[0].value,
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  country: "",
  service_modes: [] as string[],
  status: STATUSES[0].value, // "active"
  rating: 3,
  contract_ref: "",
  notes: "",
};

function typeLabel(value: string) {
  return TYPES.find((t) => t.value === value)?.label || value;
}

function statusLabel(value: string) {
  return STATUSES.find((s) => s.value === value)?.label || value;
}

function getMissingFieldsMessage(form: typeof emptyForm) {
  const missing: string[] = [];

  if (form.name.trim() === "") missing.push("Company Name");
  if (form.contact_person.trim() === "") missing.push("Contact Person");
  if (form.email.trim() === "") missing.push("Email");
  if (form.phone.trim() === "") missing.push("Phone");
  if (form.address.trim() === "") missing.push("Address");
  if (form.country.trim() === "") missing.push("Country");
  if (form.service_modes.length === 0) missing.push("Service Modes");

  if (missing.length === 0) return null;
  return `Please fill in: ${missing.join(", ")}.`;
}

export default function ServiceProvidersPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";
  const router = useRouter();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const filteredProviders = providers.filter((provider) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const haystack = [
      provider.name,
      provider.contact_person,
      provider.email,
      provider.phone,
      provider.country,
      provider.type,
      provider.contract_ref,
      provider.address,
      provider.service_modes.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  async function loadProviders() {
    setLoading(true);
    const res = await fetch("/api/service-providers");
    const data = await res.json();
    setProviders(data.providers || []);
    setLoading(false);
  }

  useEffect(() => {
    loadProviders();
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredProviders.length / PAGE_SIZE));
  const pagedProviders = filteredProviders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  function toggleMode(mode: string) {
    setForm((f) => ({
      ...f,
      service_modes: f.service_modes.includes(mode)
        ? f.service_modes.filter((m) => m !== mode)
        : [...f.service_modes, mode],
    }));
  }

  function handleEditClick(p: Provider) {
    setEditingId(p.id);
    setSaveError(null);
    setShowFieldErrors(false);
    setForm({
      name: p.name || "",
      type: p.type || TYPES[0].value,
      contact_person: p.contact_person || "",
      email: p.email || "",
      phone: p.phone || "",
      address: p.address || "",
      country: p.country || "",
      service_modes: p.service_modes || [],
      status: p.status || STATUSES[0].value,
      rating: p.rating ?? 3,
      contract_ref: p.contract_ref || "",
      notes: p.notes || "",
    });
    setShowForm(true);
  }

  function handleAddClick() {
    setEditingId(null);
    setSaveError(null);
    setShowFieldErrors(false);
    setForm(emptyForm);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setSaveError(null);
    setShowFieldErrors(false);
    setForm(emptyForm);
    setCountryOpen(false);
    setCountrySearch("");
  }

  function selectCountry(country: string) {
    setForm((f) => ({ ...f, country }));
    setCountryOpen(false);
    setCountrySearch("");
  }

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  function fieldBorderClass(value: string) {
    if (showFieldErrors && !value.trim()) {
      return "border-[#E2685A] focus:border-[#E2685A]";
    }
    return isDark ? "border-[#2C4356] focus:border-[#F2419B]" : "border-gray-300 focus:border-[#F2419B]";
  }

  async function handleSave() {
    const missingMessage = getMissingFieldsMessage(form);

    if (missingMessage) {
      setSaveError(missingMessage);
      setShowFieldErrors(true);
      return;
    }
    setShowFieldErrors(false);
    setSaving(true);
    setSaveError(null);
    try {
      const url = editingId ? `/api/service-providers/${editingId}` : "/api/service-providers";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message || (editingId ? "Failed to update provider." : "Failed to save provider."));
        return;
      }

      closeForm();
      loadProviders();
    } catch (err) {
      console.error("Save failed:", err);
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this provider?")) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/service-providers/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message || "Failed to delete provider.");
        return;
      }

      loadProviders();
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleteError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<Building2 size={20} />}
        title="Service Provider Management"
        subtitle="Manage carriers, forwarders, brokers & vendors"
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
        ) : providers.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
            No service providers yet. Add your first one.
          </p>
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
                    placeholder="Search provider, contact, email..."
                    className={`w-full rounded-md border py-2.5 pl-10 pr-3 text-sm outline-none ${
                      isDark
                        ? "border-[#2C4356] bg-[#121B26] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                    }`}
                  />
                </div>
              </div>

              {filteredProviders.length === 0 ? (
                <div
                  className={`rounded-lg border border-dashed px-4 py-10 text-center text-sm ${
                    isDark ? "border-[#2C4356] text-[#8FA0AF]" : "border-gray-300 text-gray-500"
                  }`}
                >
                  No matching service providers found.
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
                          {[
                            "Provider",
                            "Type",
                            "Contact",
                            "Country",
                            "Service Modes",
                            "Status",
                            "Rating",
                            "Actions",
                          ].map((header) => (
                            <th key={header} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={isDark ? "divide-y divide-[#23303D] text-[#C7D1DA]" : "divide-y divide-gray-200 text-gray-700"}>
                        {pagedProviders.map((p) => (
                          <tr key={p.id} className={isDark ? "bg-[#121B26] hover:bg-[#182230]" : "bg-white hover:bg-gray-50"}>
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                                    isDark ? "bg-[#1A2530] text-[#F2F1EC]" : "bg-[#FCE7F3] text-[#F2419B]"
                                  }`}
                                >
                                  <Building2 size={15} />
                                </div>
                                <div>
                                  <div className="font-semibold text-[#F2419B]">{p.name}</div>
                                  {p.contract_ref && (
                                    <div className={`text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                                      Ref: {p.contract_ref}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">{typeLabel(p.type)}</td>
                            <td className="px-4 py-4 align-top">
                              <div className="space-y-1">
                                {p.contact_person && <div>{p.contact_person}</div>}
                                {p.email && <div className="text-xs text-[#8FA0AF]">{p.email}</div>}
                                {p.phone && <div className="text-xs text-[#8FA0AF]">{p.phone}</div>}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">{p.country || "—"}</td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex flex-wrap gap-1">
                                {p.service_modes.length > 0 ? (
                                  p.service_modes.map((mode) => (
                                    <span
                                      key={mode}
                                      className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                                        isDark ? "bg-[#1A2530] text-[#C7D1DA]" : "bg-gray-100 text-gray-600"
                                      }`}
                                    >
                                      {mode}
                                    </span>
                                  ))
                                ) : (
                                  <span className={isDark ? "text-[#8FA0AF]" : "text-gray-500"}>—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  p.status === "active"
                                    ? isDark
                                      ? "bg-[#0F2E22] text-[#3BD68A]"
                                      : "bg-[#E1F7EC] text-[#1FA968]"
                                    : isDark
                                    ? "bg-[#2A1212] text-[#E2685A]"
                                    : "bg-[#FBE4E1] text-[#D9483A]"
                                }`}
                              >
                                {statusLabel(p.status)}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star
                                    key={n}
                                    size={13}
                                    className={n <= p.rating ? "fill-[#F2A23B] text-[#F2A23B]" : "text-[#4B5A68]"}
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => router.push(`/service-providers/${p.id}`)}
                                  aria-label={`View ${p.name}`}
                                  title="View provider details"
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
                                  onClick={() => handleEditClick(p)}
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
                                  onClick={() => handleDelete(p.id)}
                                  disabled={deletingId === p.id}
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#E2685A] transition hover:bg-[#2A1212] disabled:cursor-not-allowed disabled:opacity-50"
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

            {filteredProviders.length > 0 && totalPages > 1 && (
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
        onClick={handleAddClick}
        aria-label="Add Provider"
        className="fixed right-8 bottom-8 z-40 flex items-center gap-2 rounded-full bg-[#F2419B] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#F2419B]/30 transition hover:bg-[#F55CAB]"
      >
        <Plus size={18} />
        Add Provider
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
                {editingId ? "Edit Service Provider" : "New Service Provider"}
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
              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Company Name *
                </label>
                <input
                  type="text"
                  placeholder="Company name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.name)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Type
                </p>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: t.value })}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.type === t.value
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm({ ...form, status: s.value })}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.status === s.value
                          ? s.value === "active"
                            ? "bg-[#3BD68A] text-[#0B1220]"
                            : "bg-[#E2685A] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Service Modes *
                </p>
                <div className={`flex flex-wrap gap-2 rounded-md ${showFieldErrors && form.service_modes.length === 0 ? "border border-[#E2685A] p-1" : ""}`}>
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMode(m)}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.service_modes.includes(m)
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
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Rating
                </p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })}>
                      <Star
                        size={22}
                        className={n <= form.rating ? "fill-[#F2A23B] text-[#F2A23B]" : "text-[#4B5A68]"}
                      />
                    </button>
                  ))}
                  <span className={`ml-2 text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>{form.rating}/5</span>
                </div>
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Contact Person *
                </label>
                <input
                  type="text"
                  placeholder="Contact person"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.contact_person)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Email *
                </label>
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.email)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Phone *
                </label>
                <input
                  type="text"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.phone)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Address *
                </label>
                <input
                  type="text"
                  placeholder="Address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.address)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              {/* Searchable Country dropdown */}
              <div className="relative">
                <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Country *
                </label>
                <button
                  type="button"
                  onClick={() => setCountryOpen((prev) => !prev)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left outline-none ${fieldBorderClass(form.country)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC]"
                      : "bg-white text-gray-900"
                  }`}
                >
                  <span className={form.country ? "" : isDark ? "text-[#4B5A68]" : "text-gray-400"}>
                    {form.country || "Select a country"}
                  </span>
                  <ChevronDown size={16} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                </button>

                {countryOpen && (
                  <>
                    {/* Click-away backdrop */}
                    <div className="fixed inset-0 z-10" onClick={() => setCountryOpen(false)} />

                    <div
                      className={`absolute z-20 mt-1 w-full overflow-hidden rounded-md border shadow-lg ${
                        isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-300 bg-white"
                      }`}
                    >
                      <div
                        className={`flex items-center gap-2 border-b px-3 py-2 ${
                          isDark ? "border-[#2C4356]" : "border-gray-200"
                        }`}
                      >
                        <Search size={15} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search countries…"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className={`w-full bg-transparent text-sm outline-none ${
                            isDark ? "text-[#F2F1EC] placeholder:text-[#4B5A68]" : "text-gray-900 placeholder:text-gray-400"
                          }`}
                        />
                      </div>

                      <div className="max-h-56 overflow-y-auto">
                        {filteredCountries.length === 0 ? (
                          <p className={`px-3 py-3 text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                            No countries found.
                          </p>
                        ) : (
                          filteredCountries.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => selectCountry(c)}
                              className={`block w-full px-3 py-2 text-left text-sm transition ${
                                form.country === c
                                  ? "bg-[#F2419B] text-white"
                                  : isDark
                                  ? "text-[#C7D1DA] hover:bg-[#1A2530]"
                                  : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              {c}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Contract Ref
                </label>
                <input
                  type="text"
                  placeholder="DHL-SP-001"
                  value={form.contract_ref}
                  onChange={(e) => setForm({ ...form, contract_ref: e.target.value })}
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
    </div>
  );
}