"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Calendar,
  FileText,
  User,
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

const CATEGORY_OPTIONS = ["handling", "documentation", "customs", "safety", "storage", "transport", "general"];
const STATUS_OPTIONS = ["draft", "published", "under_review", "archived"];
const PAGE_SIZE = 5;
const RECENT_SEARCHES_KEY = "sops_recent_searches";
const MAX_RECENT_SEARCHES = 5;
const SOP_PREVIEW_CHARS = 30; // longer titles get "See more"
const OWNER_PREVIEW_CHARS = 22; // longer owner names get "See more"

type SOP = {
  id: string;
  title: string;
  sop_code: string;
  category: string;
  scope?: string | null;
  version: string;
  effective_date?: string | null;
  review_date?: string | null;
  content?: string | null;
  owner?: string | null;
  status: string;
};

const emptyForm = {
  title: "",
  sop_code: "",
  category: "general",
  scope: "",
  version: "1.0",
  effective_date: "",
  review_date: "",
  content: "",
  owner: "",
  status: "draft",
};

function statusColor(s: string, isDark: boolean) {
  switch (s) {
    case "published":
      return isDark ? { bg: "bg-[#0F2E22]", text: "text-[#3BD68A]" } : { bg: "bg-[#E1F7EC]", text: "text-[#1FA968]" };
    case "under_review":
      return isDark ? { bg: "bg-[#2A2010]", text: "text-[#F2A23B]" } : { bg: "bg-[#FDF0DD]", text: "text-[#C9791A]" };
    case "archived":
      return isDark ? { bg: "bg-[#1A2530]", text: "text-[#8FA0AF]" } : { bg: "bg-gray-100", text: "text-gray-500" };
    default:
      return isDark ? { bg: "bg-[#0F1F2E]", text: "text-[#38BDF8]" } : { bg: "bg-[#FCE4F1]", text: "text-[#D9297E]" };
  }
}

type DropdownOption = { value: string; label: string; badge?: string };

// Single-select dropdown in the same style as the Routes and Rates pages.
function Dropdown({
  options,
  value,
  onChange,
  placeholder,
  isDark,
  dropUp = false,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isDark: boolean;
  dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const label = (o: DropdownOption) =>
    o.badge ? (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${o.badge}`}>{o.label}</span>
    ) : (
      <span className="capitalize">{o.label}</span>
    );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left outline-none ${
          open ? "border-[#F2419B]" : isDark ? "border-[#2C4356]" : "border-gray-300"
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
            role="listbox"
            className={`absolute z-20 max-h-56 w-full overflow-y-auto rounded-md border shadow-lg ${dropUp ? "bottom-full mb-1" : "mt-1"} ${
              isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-300 bg-white"
            }`}
          >
            {options.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
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
                  {label(o)}
                  {isSelected && <Check size={14} className="shrink-0 text-[#F2419B]" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function SOPsPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";
  const router = useRouter();

  const [sops, setSops] = useState<SOP[]>([]);
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

  // Rows showing their full details ("See more")
  const [expandedSops, setExpandedSops] = useState<Set<string>>(() => new Set());

  function toggleExpanded(id: string) {
    setExpandedSops((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function fetchSops() {
    setLoading(true);
    try {
      const res = await fetch("/spnc/app/api/sops", { cache: "no-store" });
      if (!res.ok) throw new Error(`SOP request failed (${res.status})`);
      const data = await res.json();
      setSops(data.sops || []);
    } catch (err) {
      console.error("Fetch SOPs failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSops();
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
    try { await fetchSops(); } catch (error) { console.error("Search SOPs failed:", error); }
    setSearchTerm(trimmed);
    setSearching(false);
    if (trimmed) addRecentSearch(trimmed);
  }

  function clearSearch() {
    setSearchInput("");
    setSearchTerm("");
  }

  const filteredSops = sops.filter((sop) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const haystack = [
      sop.title,
      sop.sop_code,
      sop.category,
      sop.scope,
      sop.owner,
      sop.content,
      sop.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
  const totalPages = Math.max(1, Math.ceil(filteredSops.length / PAGE_SIZE));
  const pagedSops = filteredSops.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

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

  function openEditModal(s: SOP) {
    setEditingId(s.id);
    setSaveError(null);
    setShowFieldErrors(false);
    setForm({
      title: s.title,
      sop_code: s.sop_code,
      category: s.category,
      scope: s.scope || "",
      version: s.version || "1.0",
      effective_date: s.effective_date || "",
      review_date: s.review_date || "",
      content: s.content || "",
      owner: s.owner || "",
      status: s.status,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function fieldBorderClass(value: string) {
    if (showFieldErrors && !value.trim()) {
      return "border-[#E2685A] focus:border-[#E2685A]";
    }
    return isDark ? "border-[#2C4356] focus:border-[#F2419B]" : "border-gray-300 focus:border-[#F2419B]";
  }

  async function handleSave() {
    const missing: string[] = [];
    if (!form.title.trim()) missing.push("Title");
    if (!form.sop_code.trim()) missing.push("SOP Code");
    if (!form.effective_date.trim()) missing.push("Effective Date");
    if (!form.review_date.trim()) missing.push("Review Date");
    if (!form.owner.trim()) missing.push("Owner / Department");
    if (!form.content.trim()) missing.push("Procedure Content");

    if (missing.length > 0) {
      setSaveError(`Please fill in: ${missing.join(", ")}.`);
      setShowFieldErrors(true);
      return;
    }

    setShowFieldErrors(false);

    if (form.effective_date && form.review_date && form.review_date <= form.effective_date) {
      setSaveError("Review date must be after the effective date.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = {
      title: form.title,
      sop_code: form.sop_code,
      category: form.category,
      scope: form.scope,
      version: form.version,
      effective_date: form.effective_date || null,
      review_date: form.review_date || null,
      content: form.content,
      owner: form.owner,
      status: form.status,
    };

    try {
      const url = editingId ? `/spnc/app/api/sops/${editingId}` : "/spnc/app/api/sops";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message || (editingId ? "Could not update SOP." : "Could not save SOP."));
        return;
      }

      closeModal();
      fetchSops();
    } catch (err) {
      console.error("Save SOP failed:", err);
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this SOP?")) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/spnc/app/api/sops/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message || "Could not archive SOP.");
        return;
      }
      fetchSops();
    } catch (err) {
      console.error("Archive SOP failed:", err);
      setDeleteError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<ClipboardList size={20} />}
        title="Standard Operating Procedure Management"
        subtitle="Document and manage freight operating procedures"
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
        ) : sops.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
            No SOPs found. Click + New SOP to create one.
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
                    onChange={(e) => { setSearchInput(e.target.value); if (!e.target.value.trim()) setSearchTerm(""); }}
                    onFocus={() => setShowRecentSearches(true)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); runSearch(); } else if (event.key === "Escape") setShowRecentSearches(false); }}
                    placeholder="Search SOP title, code, owner..."
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
              ) : filteredSops.length === 0 ? (
                <div
                  className={`rounded-lg border border-dashed px-4 py-10 text-center text-sm ${
                    isDark ? "border-[#2C4356] text-[#8FA0AF]" : "border-gray-300 text-gray-500"
                  }`}
                >
                  No matching SOPs found.
                </div>
              ) : (
                <div
                  className={`overflow-hidden rounded-lg border ${
                    isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
                  }`}
                >
                  {/* Scrollbar hidden; the table can still be swiped sideways on very small screens */}
                  <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <table className="min-w-full divide-y divide-[#23303D] text-left">
                      <thead className={isDark ? "bg-[#0B1220] text-[#8FA0AF]" : "bg-gray-50 text-gray-500"}>
                        <tr>
                          {['SOP', 'Category', 'Owner', 'Effective', 'Review', 'Status', 'Actions'].map((header) => (
                            <th key={header} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={isDark ? "divide-y divide-[#23303D] text-[#C7D1DA]" : "divide-y divide-gray-200 text-gray-700"}>
                        {pagedSops.map((s) => {
                          const sc = statusColor(s.status, isDark);
                          return (
                            <tr key={s.id} className={isDark ? "bg-[#121B26] hover:bg-[#182230]" : "bg-white hover:bg-gray-50"}>
                              <td className="px-4 py-4 align-top">
                                {(() => {
                                  const isExpanded = expandedSops.has(s.id);
                                  const hasMore =
                                    s.title.length > SOP_PREVIEW_CHARS || (s.owner || "").length > OWNER_PREVIEW_CHARS;
                                  return (
                                    <div className="max-w-[15rem]">
                                      <div
                                        className={`font-semibold text-[#F2419B] ${isExpanded ? "" : "truncate whitespace-nowrap"}`}
                                        title={s.title}
                                      >
                                        {s.title}
                                      </div>
                                      <div className={`mt-0.5 whitespace-nowrap text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                                        {s.sop_code} · v{s.version}
                                      </div>
                                      {hasMore && (
                                        <button
                                          type="button"
                                          onClick={() => toggleExpanded(s.id)}
                                          className="mt-0.5 text-xs font-medium text-[#F2419B] hover:underline"
                                        >
                                          {isExpanded ? "See less" : "See more"}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 align-top">
                                <span className={`rounded-full border px-3 py-1 text-xs capitalize tracking-wide ${isDark ? "border-[#2C4356] text-[#C7D1DA]" : "border-gray-300 text-gray-600"}`}>
                                  {s.category}
                                </span>
                              </td>
                              <td className="px-4 py-4 align-top">
                                <div
                                  className={`max-w-[11rem] ${expandedSops.has(s.id) ? "" : "truncate whitespace-nowrap"}`}
                                  title={s.owner || undefined}
                                >
                                  {s.owner || "—"}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 align-top">{s.effective_date || "—"}</td>
                              <td className="whitespace-nowrap px-4 py-4 align-top">{s.review_date || "—"}</td>
                              <td className="whitespace-nowrap px-4 py-4 align-top">
                                <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ${sc.bg} ${sc.text}`}>
                                  {s.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="px-4 py-4 align-top">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/spnc/app/sops/${s.id}`)}
                                    aria-label={`View ${s.title}`}
                                    title="View SOP details"
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
                                    onClick={() => openEditModal(s)}
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
                                    onClick={() => handleArchive(s.id)}
                                    disabled={deletingId === s.id}
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

            {filteredSops.length > 0 && totalPages > 1 && (
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

      {/* Floating Add SOP button */}
      <button
        type="button"
        onClick={openAddModal}
        aria-label="Add SOP"
        className="fixed right-8 bottom-8 z-40 flex items-center gap-2 rounded-full bg-[#F2419B] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#F2419B]/30 transition hover:bg-[#F55CAB]"
      >
        <Plus size={18} />
        New SOP
      </button>

      {/* Add / Edit SOP modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border p-6 ${
              isDark ? "border-[#F2419B]/35 bg-[#121B26]" : "border-[#F2419B]/30 bg-white"
            }`}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                className={`text-xl font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {editingId ? "Edit SOP" : "New SOP"}
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
                  Title *
                </p>
                <input
                  type="text"
                  placeholder="Container Loading & Securing"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.title)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    SOP Code *
                  </p>
                  <input
                    type="text"
                    placeholder="SOP-HND-001"
                    value={form.sop_code}
                    onChange={(e) => setForm({ ...form, sop_code: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.sop_code)} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Version
                  </p>
                  <input
                    type="text"
                    placeholder="1.0"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
                      isDark
                        ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Category
                </p>
                <Dropdown
                  isDark={isDark}
                  placeholder="Select a category"
                  value={form.category}
                  onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
                />
              </div>

              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Scope
                </p>
                <input
                  type="text"
                  placeholder="e.g. All sea freight routes"
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value })}
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
                    Effective Date *
                  </p>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.effective_date)} ${
                      isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"
                    }`}
                  />
                </div>
                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Review Date *
                  </p>
                  <input
                    type="date"
                    value={form.review_date}
                    onChange={(e) => setForm({ ...form, review_date: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.review_date)} ${
                      isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Owner / Department *
                </p>
                <input
                  type="text"
                  placeholder="Operations Dept"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.owner)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Procedure Content *
                </p>
                <textarea
                  placeholder="Describe the procedure..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className={`h-32 w-full resize-none rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.content)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
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
                    const sc = statusColor(s, isDark);
                    return { value: s, label: s.replace("_", " "), badge: `${sc.bg} ${sc.text}` };
                  })}
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