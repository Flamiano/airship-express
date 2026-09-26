"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Star,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Archive,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Eye,
  Check,
  Clock,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";

const TYPES: { label: string; value: string }[] = [
  { label: "Carrier", value: "carrier" },
  { label: "Freight Forwarder", value: "freight_forwarder" },
  { label: "Customs Broker", value: "customs_broker" },
  { label: "Warehouse", value: "warehouse" },
  { label: "3PL", value: "3pl" },
  { label: "Other", value: "other" },
];

const MODES = ["Road", "Rail", "Air", "Sea", "Multimodal"];
const STATUSES: { label: string; value: string }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];
const PAGE_SIZE = 5;
const RECENT_SEARCHES_KEY = "service_providers_recent_searches";
const MAX_RECENT_SEARCHES = 5;

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

// Phone country codes. Where several countries share a code (e.g. +1), the first one listed wins when reading an old number.
const DIAL_CODES: { iso: string; name: string; code: string }[] = [
  { iso: "PH", name: "Philippines", code: "+63" },
  { iso: "US", name: "United States", code: "+1" },
  { iso: "CA", name: "Canada", code: "+1" },
  { iso: "GB", name: "United Kingdom", code: "+44" },
  { iso: "AU", name: "Australia", code: "+61" },
  { iso: "NZ", name: "New Zealand", code: "+64" },
  { iso: "SG", name: "Singapore", code: "+65" },
  { iso: "MY", name: "Malaysia", code: "+60" },
  { iso: "ID", name: "Indonesia", code: "+62" },
  { iso: "TH", name: "Thailand", code: "+66" },
  { iso: "VN", name: "Vietnam", code: "+84" },
  { iso: "KH", name: "Cambodia", code: "+855" },
  { iso: "LA", name: "Laos", code: "+856" },
  { iso: "MM", name: "Myanmar", code: "+95" },
  { iso: "BN", name: "Brunei", code: "+673" },
  { iso: "CN", name: "China", code: "+86" },
  { iso: "HK", name: "Hong Kong", code: "+852" },
  { iso: "MO", name: "Macau", code: "+853" },
  { iso: "TW", name: "Taiwan", code: "+886" },
  { iso: "JP", name: "Japan", code: "+81" },
  { iso: "KR", name: "South Korea", code: "+82" },
  { iso: "MN", name: "Mongolia", code: "+976" },
  { iso: "IN", name: "India", code: "+91" },
  { iso: "PK", name: "Pakistan", code: "+92" },
  { iso: "BD", name: "Bangladesh", code: "+880" },
  { iso: "LK", name: "Sri Lanka", code: "+94" },
  { iso: "NP", name: "Nepal", code: "+977" },
  { iso: "AE", name: "United Arab Emirates", code: "+971" },
  { iso: "SA", name: "Saudi Arabia", code: "+966" },
  { iso: "QA", name: "Qatar", code: "+974" },
  { iso: "KW", name: "Kuwait", code: "+965" },
  { iso: "BH", name: "Bahrain", code: "+973" },
  { iso: "OM", name: "Oman", code: "+968" },
  { iso: "IL", name: "Israel", code: "+972" },
  { iso: "TR", name: "Turkey", code: "+90" },
  { iso: "EG", name: "Egypt", code: "+20" },
  { iso: "MA", name: "Morocco", code: "+212" },
  { iso: "NG", name: "Nigeria", code: "+234" },
  { iso: "GH", name: "Ghana", code: "+233" },
  { iso: "KE", name: "Kenya", code: "+254" },
  { iso: "ZA", name: "South Africa", code: "+27" },
  { iso: "DE", name: "Germany", code: "+49" },
  { iso: "FR", name: "France", code: "+33" },
  { iso: "IT", name: "Italy", code: "+39" },
  { iso: "ES", name: "Spain", code: "+34" },
  { iso: "PT", name: "Portugal", code: "+351" },
  { iso: "NL", name: "Netherlands", code: "+31" },
  { iso: "BE", name: "Belgium", code: "+32" },
  { iso: "CH", name: "Switzerland", code: "+41" },
  { iso: "AT", name: "Austria", code: "+43" },
  { iso: "IE", name: "Ireland", code: "+353" },
  { iso: "SE", name: "Sweden", code: "+46" },
  { iso: "NO", name: "Norway", code: "+47" },
  { iso: "DK", name: "Denmark", code: "+45" },
  { iso: "FI", name: "Finland", code: "+358" },
  { iso: "PL", name: "Poland", code: "+48" },
  { iso: "CZ", name: "Czechia", code: "+420" },
  { iso: "GR", name: "Greece", code: "+30" },
  { iso: "RO", name: "Romania", code: "+40" },
  { iso: "HU", name: "Hungary", code: "+36" },
  { iso: "UA", name: "Ukraine", code: "+380" },
  { iso: "RU", name: "Russia", code: "+7" },
  { iso: "MX", name: "Mexico", code: "+52" },
  { iso: "BR", name: "Brazil", code: "+55" },
  { iso: "AR", name: "Argentina", code: "+54" },
  { iso: "CL", name: "Chile", code: "+56" },
  { iso: "CO", name: "Colombia", code: "+57" },
  { iso: "PE", name: "Peru", code: "+51" },
  { iso: "VE", name: "Venezuela", code: "+58" },
  { iso: "FJ", name: "Fiji", code: "+679" },
  { iso: "PG", name: "Papua New Guinea", code: "+675" },
];
const DEFAULT_DIAL_ISO = "PH";
// Countries whose numbers keep their leading 0 after the country code (e.g. Italian landlines).
const KEEP_LEADING_ZERO = new Set(["IT"]);

// Drop the local "trunk" 0 (e.g. PH 0917… → 917…), since the country code replaces it.
function stripTrunkZero(iso: string, digits: string) {
  return KEEP_LEADING_ZERO.has(iso) ? digits : digits.replace(/^0+/, "");
}
const PHONE_MIN_DIGITS = 6;
const PHONE_MAX_DIGITS = 15;

// Per-country digit groupings used only for display, e.g. PH -> "9939 233 4932" (4-3-4).
// Add more entries here for other countries that need a specific grouping.
const PHONE_GROUPS: Record<string, number[]> = {
  PH: [4, 3, 4],
};

// Formats raw digits into a readable, grouped string for display in the input.
// Falls back to plain digits for countries without a defined grouping.
function formatPhoneDigits(iso: string, digits: string) {
  const groups = PHONE_GROUPS[iso];
  if (!groups) return digits;

  const parts: string[] = [];
  let cursor = 0;
  for (const size of groups) {
    if (cursor >= digits.length) break;
    parts.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }
  return parts.filter(Boolean).join(" ");
}

function dialByIso(iso: string) {
  return DIAL_CODES.find((d) => d.iso === iso) || DIAL_CODES[0];
}

// Formats a stored phone string (e.g. "+63 92838232200") for display with grouped digits
// (e.g. "+63 9283 823 2200"). Used anywhere a saved phone number is shown, like the table.
function displayPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const { iso, digits } = parsePhone(phone);
  if (!digits) return phone;
  return `${dialByIso(iso).code} ${formatPhoneDigits(iso, digits)}`;
}

// Build the stored phone string, e.g. "+63 9171234567". Empty when no digits so "required" validation still works.
function composePhone(iso: string, digits: string) {
  return digits ? `${dialByIso(iso).code} ${digits}` : "";
}

// Split a saved phone back into country + digits. Uses the longest matching code.
function parsePhone(phone: string | null | undefined): { iso: string; digits: string } {
  const raw = (phone ?? "").trim();
  if (!raw) return { iso: DEFAULT_DIAL_ISO, digits: "" };
  const compact = raw.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) {
    let best: (typeof DIAL_CODES)[number] | null = null;
    for (const d of DIAL_CODES) {
      if (compact.startsWith(d.code) && (!best || d.code.length > best.code.length)) best = d;
    }
    if (best) return { iso: best.iso, digits: stripTrunkZero(best.iso, compact.slice(best.code.length).replace(/\D/g, "")) };
  }
  return { iso: DEFAULT_DIAL_ISO, digits: stripTrunkZero(DEFAULT_DIAL_ISO, compact.replace(/\D/g, "")) };
}

type ProviderAttachment = {
  name: string;
  dataUrl: string;
};

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
  attachments?: ProviderAttachment[];
};

function createEmptyForm() {
  return {
    name: "",
    type: TYPES[0].value,
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    service_modes: [] as string[],
    status: STATUSES[0].value,
    rating: 3,
    contract_ref: "",
    notes: "",
  };
}

function typeLabel(value: string) {
  return TYPES.find((t) => t.value === value)?.label || value;
}

function statusLabel(value: string) {
  return STATUSES.find((s) => s.value === value)?.label || value;
}

function asString(value: string | null | undefined) {
  return value ?? "";
}

function normalizeProvider(provider: Partial<Provider> & { id: string }): Provider {
  return {
    id: provider.id,
    name: asString(provider.name),
    type: asString(provider.type),
    contact_person: provider.contact_person ?? null,
    email: provider.email ?? null,
    phone: provider.phone ?? null,
    address: provider.address ?? null,
    country: provider.country ?? null,
    service_modes: Array.isArray(provider.service_modes) ? provider.service_modes : [],
    status: asString(provider.status) || STATUSES[0].value,
    rating: provider.rating ?? 3,
    contract_ref: provider.contract_ref ?? null,
    notes: provider.notes ?? null,
    attachments: provider.attachments,
  };
}

function getStep1MissingFieldsMessage(form: ReturnType<typeof createEmptyForm>, customType: string) {
  const missing: string[] = [];

  if (form.name.trim() === "") missing.push("Company Name");
  if (form.type === "other" && customType.trim() === "") missing.push("Custom type");
  if (form.service_modes.length === 0) missing.push("Service Modes");

  if (missing.length === 0) return null;
  return `Please fill in: ${missing.join(", ")}.`;
}

function getStep2MissingFieldsMessage(form: ReturnType<typeof createEmptyForm>) {
  const missing: string[] = [];

  if (form.contact_person.trim() === "") missing.push("Contact Person");
  if (form.email.trim() === "") missing.push("Email");
  if (form.phone.trim() === "") missing.push("Phone");
  if (form.address.trim() === "") missing.push("Address");
  if (form.country.trim() === "") missing.push("Country");

  if (missing.length > 0) return `Please fill in: ${missing.join(", ")}.`;

  const phoneDigits = parsePhone(form.phone).digits;
  if (phoneDigits.length < PHONE_MIN_DIGITS || phoneDigits.length > PHONE_MAX_DIGITS) {
    return `Phone number should be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (not counting the country code).`;
  }

  return null;
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
  const [form, setForm] = useState(() => createEmptyForm());
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // the search that's applied to the table
  const [searchInput, setSearchInput] = useState(""); // what's typed in the box
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Multi-step form state
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [customType, setCustomType] = useState("");
  const [pdfFiles, setPdfFiles] = useState<Array<{ name: string; dataUrl: string }>>([]);

  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [typeOpen, setTypeOpen] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);

  // Phone: country code + digits-only number
  const [phoneIso, setPhoneIso] = useState(DEFAULT_DIAL_ISO);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [dialOpen, setDialOpen] = useState(false);
  const [dialSearch, setDialSearch] = useState("");

  function resetPhone(phone?: string | null) {
    const parsed = parsePhone(phone);
    setPhoneIso(parsed.iso);
    setPhoneDigits(parsed.digits);
    setDialOpen(false);
    setDialSearch("");
  }

  function updatePhoneDigits(value: string) {
    const digits = stripTrunkZero(phoneIso, value.replace(/\D/g, "")).slice(0, PHONE_MAX_DIGITS);
    setPhoneDigits(digits);
    setForm((f) => ({ ...f, phone: composePhone(phoneIso, digits) }));
  }

  function selectDialCode(iso: string) {
    const digits = stripTrunkZero(iso, phoneDigits);
    setPhoneIso(iso);
    setPhoneDigits(digits);
    setForm((f) => ({ ...f, phone: composePhone(iso, digits) }));
    setDialOpen(false);
    setDialSearch("");
  }

  const filteredDialCodes = DIAL_CODES.filter((d) => {
    const q = dialSearch.trim().toLowerCase();
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || d.code.includes(q) || d.iso.toLowerCase() === q;
  });

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

  async function fetchProviders() {
    const res = await fetch("/spnc/app/api/service-providers", { cache: "no-store" });
    const data = await res.json();
    setProviders(
      Array.isArray(data.providers)
        ? data.providers.filter((provider: Partial<Provider>) => typeof provider.id === "string").map(normalizeProvider)
        : []
    );
  }

  async function loadProviders() {
    setLoading(true);
    try {
      await fetchProviders();
    } catch (err) {
      console.error("Fetch providers failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  // ---- Search: recent searches + fetch on search ----
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {
      // ignore unavailable/corrupt storage
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
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
      // ignore
    }
  }

  function addRecentSearch(term: string) {
    const deduped = [term, ...recentSearches.filter((t) => t.toLowerCase() !== term.toLowerCase())];
    persistRecentSearches(deduped.slice(0, MAX_RECENT_SEARCHES));
  }

  // Runs when you press Enter, click the search icon, or pick a recent search.
  async function runSearch(term: string = searchInput) {
    const trimmed = term.trim();
    setSearchInput(term);
    setShowRecentSearches(false);
    setSearching(true);
    try {
      await fetchProviders(); // get the latest providers from the server
    } catch (err) {
      console.error("Search failed:", err);
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
    setFormStep(1);
    setPdfFiles(p.attachments ?? []);
    const detectedType = TYPES.some((t) => t.value === p.type) ? p.type : "other";
    setCustomType(detectedType === "other" ? asString(p.type) : "");
    const parsedPhone = parsePhone(p.phone);
    resetPhone(p.phone);
    setForm({
      name: asString(p.name),
      type: detectedType,
      contact_person: asString(p.contact_person),
      email: asString(p.email),
      phone: composePhone(parsedPhone.iso, parsedPhone.digits),
      address: asString(p.address),
      country: asString(p.country),
      service_modes: p.service_modes || [],
      status: p.status || STATUSES[0].value,
      rating: p.rating ?? 3,
      contract_ref: asString(p.contract_ref),
      notes: asString(p.notes),
    });
    setShowForm(true);
  }

  function handleAddClick() {
    setEditingId(null);
    setSaveError(null);
    setShowFieldErrors(false);
    setFormStep(1);
    setCustomType("");
    setPdfFiles([]);
    setForm(createEmptyForm());
    resetPhone();
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setSaveError(null);
    setShowFieldErrors(false);
    setFormStep(1);
    setCustomType("");
    setPdfFiles([]);
    setForm(createEmptyForm());
    setCountryOpen(false);
    setCountrySearch("");
    setTypeOpen(false);
    setModesOpen(false);
    resetPhone();
  }

  function selectCountry(country: string) {
    setForm((f) => ({ ...f, country }));
    setCountryOpen(false);
    setCountrySearch("");
  }

  function fieldBorderClass(value: string | null | undefined) {
    const safeValue = value ?? "";
    if (showFieldErrors && !safeValue.trim()) {
      return "border-[#E2685A] focus:border-[#E2685A]";
    }
    return isDark ? "border-[#2C4356] focus:border-[#F2419B]" : "border-gray-300 focus:border-[#F2419B]";
  }

  function handleNext() {
    const missingMessage = getStep1MissingFieldsMessage(form, customType);

    if (missingMessage) {
      setSaveError(missingMessage);
      setShowFieldErrors(true);
      return;
    }

    setSaveError(null);
    setShowFieldErrors(false);
    setTypeOpen(false);
    setModesOpen(false);
    setFormStep(2);
  }

  function handleBack() {
    setSaveError(null);
    setShowFieldErrors(false);
    setCountryOpen(false);
    setDialOpen(false);
    setFormStep((current) => (current === 1 ? 1 : ((current - 1) as 1 | 2 | 3)));
  }

  function handleToStatusStep() {
    const missingMessage = getStep2MissingFieldsMessage(form);

    if (missingMessage) {
      setSaveError(missingMessage);
      setShowFieldErrors(true);
      return;
    }

    setSaveError(null);
    setShowFieldErrors(false);
    setDialOpen(false);
    setCountryOpen(false);
    setFormStep(3);
  }

  async function handleSave() {
    const missingMessage = getStep2MissingFieldsMessage(form);

    if (missingMessage) {
      setSaveError(missingMessage);
      setShowFieldErrors(true);
      return;
    }
    setShowFieldErrors(false);
    setSaving(true);
    setSaveError(null);
    try {
      const finalType = form.type === "other" ? customType.trim() || "Other" : form.type;
      const attachments = await Promise.all(
        pdfFiles.map(async (file) => {
          if (file.dataUrl) return file;
          return { name: file.name, dataUrl: "" };
        })
      );
      const url = editingId ? `/spnc/app/api/service-providers/${editingId}` : "/spnc/app/api/service-providers";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: finalType, attachments }),
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

  async function handleArchive(id: string) {
    if (!confirm("Archive this provider?")) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/spnc/app/api/service-providers/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message || "Failed to archive provider.");
        return;
      }

      loadProviders();
    } catch (err) {
      console.error("Archive failed:", err);
      setDeleteError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const phoneBorder =
    showFieldErrors && !form.phone.trim()
      ? "border-[#E2685A]"
      : isDark
      ? "border-[#2C4356]"
      : "border-gray-300";

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
                <div className="relative w-full max-w-md" ref={searchWrapperRef}>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      if (!e.target.value.trim()) setSearchTerm(""); // emptied the box → show everything again
                    }}
                    onFocus={() => setShowRecentSearches(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        runSearch();
                      } else if (e.key === "Escape") {
                        setShowRecentSearches(false);
                      }
                    }}
                    placeholder="Search provider, contact, email..."
                    className={`w-full rounded-md border py-2.5 pl-3 pr-20 text-sm outline-none ${
                      isDark
                        ? "border-[#2C4356] bg-[#121B26] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                    }`}
                  />

                  <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    {searchInput && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        aria-label="Clear search"
                        title="Clear"
                        className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                          isDark ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        }`}
                      >
                        <X size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => runSearch()}
                      disabled={searching}
                      aria-label="Search"
                      title="Search"
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F2419B] text-white transition hover:bg-[#F55CAB] disabled:opacity-70"
                    >
                      {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    </button>
                  </div>

                  {showRecentSearches && recentSearches.length > 0 && (
                    <div
                      className={`absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-md border shadow-lg ${
                        isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide ${
                          isDark ? "text-[#8FA0AF]" : "text-gray-500"
                        }`}
                      >
                        <span>Recent searches</span>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            persistRecentSearches([]);
                          }}
                          className={`normal-case ${isDark ? "text-[#8FA0AF] hover:text-[#F2F1EC]" : "text-gray-400 hover:text-gray-700"}`}
                        >
                          Clear
                        </button>
                      </div>
                      <ul>
                        {recentSearches.map((term) => (
                          <li key={term}>
                            <div
                              className={`group flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                                isDark ? "text-[#C7D1DA] hover:bg-[#182230]" : "text-gray-700 hover:bg-gray-50"
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                runSearch(term);
                              }}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <Clock size={13} className={`shrink-0 ${isDark ? "text-[#4B5A68]" : "text-gray-400"}`} />
                                <span className="truncate">{term}</span>
                              </span>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  persistRecentSearches(recentSearches.filter((t) => t !== term));
                                }}
                                aria-label={`Remove "${term}" from recent searches`}
                                className={`opacity-0 transition group-hover:opacity-100 ${
                                  isDark ? "text-[#4B5A68] hover:text-[#F2F1EC]" : "text-gray-300 hover:text-gray-600"
                                }`}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {searching ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 size={32} className="animate-spin text-[#F2419B]" />
                  <p className="text-sm font-semibold text-[#F2419B]">Searching…</p>
                </div>
              ) : filteredProviders.length === 0 ? (
                <div
                  className={`rounded-lg border border-dashed px-4 py-10 text-center text-sm ${
                    isDark ? "border-[#2C4356] text-[#8FA0AF]" : "border-gray-300 text-gray-500"
                  }`}
                >
                  No matching service providers found{searchTerm ? ` for “${searchTerm}”` : ""}.
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
                                {p.phone && <div className="text-xs text-[#8FA0AF]">{displayPhone(p.phone)}</div>}
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
                                  onClick={() => router.push(`/spnc/app/service-providers/${p.id}`)}
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
                                  onClick={() => handleArchive(p.id)}
                                  disabled={deletingId === p.id}
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#E2685A] transition hover:bg-[#2A1212] disabled:cursor-not-allowed disabled:opacity-50"
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

            {!searching && filteredProviders.length > 0 && totalPages > 1 && (
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
            <div className="mb-2 flex items-center justify-between">
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

            <div className="mb-5 flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex flex-1 items-center gap-1.5">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                      formStep === step
                        ? "bg-[#F2419B] text-white"
                        : isDark
                        ? "bg-[#1A2530] text-[#8FA0AF]"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {step}
                  </span>
                  <span className={`text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    {step === 1 ? "Basics" : step === 2 ? "Details" : "Status"}
                  </span>
                </div>
              ))}
            </div>

            {formStep === 1 ? (
              <div className="space-y-4">
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Company Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Company name"
                    value={asString(form.name)}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.name)} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>

                <div className="relative">
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Type *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setModesOpen(false);
                      setTypeOpen((prev) => !prev);
                    }}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left outline-none ${
                      isDark ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC]" : "border-gray-300 bg-white text-gray-900"
                    }`}
                  >
                    <span>{typeLabel(form.type)}</span>
                    <ChevronDown size={16} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                  </button>

                  {typeOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setTypeOpen(false)} />
                      <div
                        className={`absolute z-20 mt-1 w-full overflow-hidden rounded-md border shadow-lg ${
                          isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-300 bg-white"
                        }`}
                      >
                        {TYPES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => {
                              setForm((f) => ({ ...f, type: t.value }));
                              if (t.value !== "other") {
                                setCustomType("");
                              }
                              setTypeOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                              form.type === t.value
                                ? "bg-[#F2419B] text-white"
                                : isDark
                                ? "text-[#C7D1DA] hover:bg-[#1A2530]"
                                : "text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {t.label}
                            {form.type === t.value && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {form.type === "other" && (
                  <div>
                    <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                      Other Type *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter custom type"
                      value={asString(customType)}
                      onChange={(e) => setCustomType(e.target.value)}
                      className={`w-full rounded-md border px-3 py-2.5 outline-none ${
                        isDark
                          ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                          : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                      }`}
                    />
                  </div>
                )}

                <div className="relative">
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Service Modes *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTypeOpen(false);
                      setModesOpen((prev) => !prev);
                    }}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left outline-none ${
                      showFieldErrors && form.service_modes.length === 0
                        ? "border-[#E2685A]"
                        : isDark
                        ? "border-[#2C4356]"
                        : "border-gray-300"
                    } ${isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"}`}
                  >
                    <span className={form.service_modes.length > 0 ? "" : isDark ? "text-[#4B5A68]" : "text-gray-400"}>
                      {form.service_modes.length > 0 ? form.service_modes.join(", ") : "Select service modes"}
                    </span>
                    <ChevronDown size={16} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                  </button>

                  {modesOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setModesOpen(false)} />
                      <div
                        className={`absolute z-20 mt-1 w-full overflow-hidden rounded-md border shadow-lg ${
                          isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-300 bg-white"
                        }`}
                      >
                        {MODES.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => toggleMode(m)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                              form.service_modes.includes(m)
                                ? isDark
                                  ? "bg-[#1A2530] text-[#F2F1EC]"
                                  : "bg-gray-100 text-gray-900"
                                : isDark
                                ? "text-[#C7D1DA] hover:bg-[#1A2530]"
                                : "text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {m}
                            {form.service_modes.includes(m) && <Check size={14} className="text-[#F2419B]" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {saveError && (
                  <div className="border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
                    {saveError}
                  </div>
                )}
              </div>
            ) : formStep === 2 ? (
              <div className="space-y-4">
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    placeholder="Contact person"
                    value={asString(form.contact_person)}
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
                    value={asString(form.email)}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.email)} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>

                {/* PHONE — country code picker + digits-only number, grouped for readability (e.g. PH: 9939 233 4932) */}
                <div className="relative">
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Phone *
                  </label>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => {
                        setCountryOpen(false);
                        setDialOpen((prev) => !prev);
                      }}
                      aria-label="Change country code"
                      title={dialByIso(phoneIso).name}
                      className={`flex shrink-0 items-center gap-1.5 rounded-l-md border border-r-0 px-3 py-2.5 text-sm font-medium outline-none ${phoneBorder} ${
                        isDark ? "bg-[#1A2530] text-[#F2F1EC] hover:bg-[#223040]" : "bg-gray-50 text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      <span className={`text-[10px] font-semibold ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}>{phoneIso}</span>
                      {dialByIso(phoneIso).code}
                      <ChevronDown size={14} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                    </button>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder={phoneIso === "PH" ? "9939 233 4932" : "Phone number"}
                      value={formatPhoneDigits(phoneIso, phoneDigits)}
                      onChange={(e) => updatePhoneDigits(e.target.value)}
                      onKeyDown={(e) => {
                        // Block letters/symbols; allow digits and editing/navigation keys & shortcuts.
                        if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
                      }}
                      className={`w-full min-w-0 rounded-r-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${phoneBorder} ${
                        isDark
                          ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                          : "bg-white text-gray-900 placeholder:text-gray-400"
                      }`}
                    />
                  </div>

                  {dialOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDialOpen(false)} />
                      <div
                        className={`absolute left-0 z-20 mt-1 w-72 overflow-hidden rounded-md border shadow-lg ${
                          isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-300 bg-white"
                        }`}
                      >
                        <div className={`flex items-center gap-2 border-b px-3 py-2 ${isDark ? "border-[#2C4356]" : "border-gray-200"}`}>
                          <Search size={15} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search country or code…"
                            value={dialSearch}
                            onChange={(e) => setDialSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && filteredDialCodes[0]) {
                                e.preventDefault();
                                selectDialCode(filteredDialCodes[0].iso);
                              } else if (e.key === "Escape") {
                                setDialOpen(false);
                              }
                            }}
                            className={`w-full bg-transparent text-sm outline-none ${
                              isDark ? "text-[#F2F1EC] placeholder:text-[#4B5A68]" : "text-gray-900 placeholder:text-gray-400"
                            }`}
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {filteredDialCodes.length === 0 ? (
                            <p className={`px-3 py-3 text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>No matches.</p>
                          ) : (
                            filteredDialCodes.map((d) => (
                              <button
                                key={d.iso}
                                type="button"
                                onClick={() => selectDialCode(d.iso)}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                                  phoneIso === d.iso
                                    ? "bg-[#F2419B] text-white"
                                    : isDark
                                    ? "text-[#C7D1DA] hover:bg-[#1A2530]"
                                    : "text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                <span className="truncate">{d.name}</span>
                                <span className="ml-3 shrink-0 font-medium">{d.code}</span>
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
                    Address *
                  </label>
                  <input
                    type="text"
                    placeholder="Address"
                    value={asString(form.address)}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.address)} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>

                <div className="relative">
                  <label className={`mb-1 block text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Country *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDialOpen(false);
                      setCountryOpen((prev) => !prev);
                    }}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left outline-none ${fieldBorderClass(form.country)} ${
                      isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"
                    }`}
                  >
                    <span className={form.country ? "" : isDark ? "text-[#4B5A68]" : "text-gray-400"}>
                      {form.country || "Select a country"}
                    </span>
                    <ChevronDown size={16} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
                  </button>

                  {countryOpen && (
                    <>
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
                            value={asString(countrySearch)}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className={`w-full bg-transparent text-sm outline-none ${
                              isDark ? "text-[#F2F1EC] placeholder:text-[#4B5A68]" : "text-gray-900 placeholder:text-gray-400"
                            }`}
                          />
                        </div>

                        <div className="max-h-56 overflow-y-auto">
                          {COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 ? (
                            <p className={`px-3 py-3 text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                              No countries found.
                            </p>
                          ) : (
                            COUNTRIES.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase())).map((c) => (
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
                    value={asString(form.contract_ref)}
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
            ) : (
              <div className="space-y-4">
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
                    Attach PDF files
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={async (event) => {
                      const files = Array.from(event.target.files || []);
                      const dataUrls = await Promise.all(
                        files.map(
                          (file) =>
                            new Promise<{ name: string; dataUrl: string }>((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result || "") });
                              reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
                              reader.readAsDataURL(file);
                            })
                        )
                      );
                      setPdfFiles(dataUrls);
                    }}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${
                      isDark
                        ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC]"
                        : "border-gray-300 bg-white text-gray-900"
                    }`}
                  />
                  {pdfFiles.length > 0 && (
                    <ul className={`mt-2 space-y-1 text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                      {pdfFiles.map((file) => (
                        <li key={file.name}>• {file.name}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {saveError && (
                  <div className="border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
                    {saveError}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              {formStep === 1 ? (
                <>
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
                    onClick={handleNext}
                    className="flex-1 rounded-md bg-[#F2419B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#F55CAB]"
                  >
                    Next
                  </button>
                </>
              ) : formStep === 2 ? (
                <>
                  <button
                    type="button"
                    onClick={handleBack}
                    className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition ${
                      isDark
                        ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleToStatusStep}
                    className="flex-1 rounded-md bg-[#F2419B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#F55CAB]"
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleBack}
                    className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition ${
                      isDark
                        ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Back
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
