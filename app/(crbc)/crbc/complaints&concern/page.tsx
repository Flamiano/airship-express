"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle, CheckCircle2, Search,
  User, AlertTriangle, Package,
  FileText, Plus, Send, Truck,
  MessageSquare, Edit, X, Loader2, RefreshCw, SearchCode, Tag
} from "lucide-react";
import { getStaffConcerns, updateConcern, addCustomerUpdate, addInternalNote, getConcernDetail, requestInvestigation } from "../../actions/concern";
import type { Concern, ConcernCategory, ConcernStatus } from "../../types/concern";

const PRIORITY_STYLE: Record<"high" | "medium" | "low", { label: string; bg: string; color: string; dot: string }> = {
  high: { label: "High", bg: "bg-red-50 dark:bg-red-950/40", color: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  medium: { label: "Medium", bg: "bg-amber-50 dark:bg-amber-950/40", color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  low: { label: "Low", bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
};

const STATUS_STYLE: Record<ConcernStatus, { label: string; bg: string; color: string }> = {
  open: { label: "Open", bg: "bg-red-50 dark:bg-red-950/40", color: "text-red-600 dark:text-red-400" },
  in_progress: { label: "In Progress", bg: "bg-amber-50 dark:bg-amber-950/40", color: "text-amber-600 dark:text-amber-400" },
  resolved: { label: "Resolved", bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-600 dark:text-emerald-400" },
  closed: { label: "Closed", bg: "bg-line/60", color: "text-muted" },
};

const CATEGORIES: { value: ConcernCategory; label: string; icon: React.ReactNode }[] = [
  { value: "delivery", label: "Delivery Issue", icon: <Truck size={12} /> },
  { value: "wrong_item", label: "Wrong Item", icon: <Package size={12} /> },
  { value: "damaged", label: "Damaged Item", icon: <AlertTriangle size={12} /> },
  { value: "billing", label: "Billing Inquiry", icon: <FileText size={12} /> },
  { value: "other", label: "Other", icon: <Tag size={12} /> },
];

function StatusBadge({ status }: { status: ConcernStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.bg} ${s.color}`}>
      {s.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.bg} ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: ConcernCategory }) {
  const cat = CATEGORIES.find(c => c.value === category);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-foreground/10 text-foreground/60 whitespace-nowrap">
      {cat?.icon}{cat?.label ?? category}
    </span>
  );
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div className="shrink-0 rounded-full bg-foreground/10 flex items-center justify-center font-medium text-foreground"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials(name)}
    </div>
  );
}

function TimelineDot({ type }: { type: string }) {
  const cls = type === "resolved" || type === "closed" ? "bg-emerald-500"
    : type === "created" ? "bg-accent"
    : type === "assigned" ? "bg-violet-500"
    : type === "internal_note" ? "bg-amber-500"
    : type === "investigation_requested" ? "bg-sky-500"
    : "bg-foreground/20";
  return <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cls}`} />;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/* ---------- presentational helpers (UI only) ---------- */

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" | "emerald" }) {
  const toneCls =
    tone === "red" ? "text-red-600 dark:text-red-400"
    : tone === "amber" ? "text-amber-600 dark:text-amber-400"
    : tone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : "text-foreground";
  return (
    <div className="rounded-lg border border-line bg-background px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background border border-line rounded-lg">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted mb-0.5">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4" onClick={onClose}>
      <div
        className="bg-background border border-line rounded-xl w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-muted hover:text-foreground hover:bg-line/50 transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50 placeholder:text-foreground/30";
const selectCls =
  "w-full py-2 px-3 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50";
const ghostBtn =
  "px-3 py-1.5 text-sm font-medium text-foreground bg-background border border-line rounded-lg hover:bg-line/50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50";
const accentBtn =
  "px-3 py-1.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50";

export default function ComplaintsConcernPage() {
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [selected, setSelected] = useState<Concern | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");

  // Modal states
  const [showCustomerUpdateModal, setShowCustomerUpdateModal] = useState(false);
  const [showInternalNoteModal, setShowInternalNoteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [showInvestigationModal, setShowInvestigationModal] = useState(false);

  // Form states
  const [customerUpdateText, setCustomerUpdateText] = useState("");
  const [internalNoteText, setInternalNoteText] = useState("");
  const [newStatus, setNewStatus] = useState<ConcernStatus>("in_progress");
  const [assigneeId, setAssigneeId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [investigationNotes, setInvestigationNotes] = useState("");
  const [investigationError, setInvestigationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadConcerns = useCallback(async function loadConcerns() {
    try {
      setError(null);
      const result = await getStaffConcerns({
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        assignedTo: assignmentFilter !== "all" ? assignmentFilter : undefined,
        search: search || undefined,
      });
      if (result.error) throw new Error(result.error);
      setConcerns(result.concerns);
      if (result.concerns.length > 0 && !selected) {
        await loadConcernDetail(result.concerns[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load concerns");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, priorityFilter, assignmentFilter, search]);

  async function loadConcernDetail(concernId: string) {
    const result = await getConcernDetail(concernId);
    if (!result.error && result.concern) {
      setSelected(result.concern);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { loadConcerns(); }, 300);
    return () => clearTimeout(timer);
  }, [loadConcerns]);

  async function handleAction(action: () => Promise<void>) {
    setSubmitting(true);
    try {
      await action();
      await loadConcernDetail(selected!.id);
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddCustomerUpdate() {
    if (!customerUpdateText.trim() || !selected) return;
    await handleAction(async () => {
      const result = await addCustomerUpdate({ concernId: selected.id, text: customerUpdateText.trim() });
      if (result.error) throw new Error(result.error);
      setCustomerUpdateText("");
      setShowCustomerUpdateModal(false);
    });
  }

  async function handleAddInternalNote() {
    if (!internalNoteText.trim() || !selected) return;
    await handleAction(async () => {
      const result = await addInternalNote({ concernId: selected.id, text: internalNoteText.trim() });
      if (result.error) throw new Error(result.error);
      setInternalNoteText("");
      setShowInternalNoteModal(false);
    });
  }

  async function handleStatusChange() {
    if (!selected) return;
    await handleAction(async () => {
      const result = await updateConcern(selected.id, { status: newStatus });
      if (result.error) throw new Error(result.error);
      setShowStatusModal(false);
    });
  }

  async function handleAssign() {
    if (!selected) return;
    await handleAction(async () => {
      const result = await updateConcern(selected.id, { assignedTo: assigneeId || null });
      if (result.error) throw new Error(result.error);
      setShowAssignModal(false);
    });
  }

  async function handleRequestInvestigation() {
    if (!investigationNotes.trim() || !selected) return;
    setInvestigationError(null);
    await handleAction(async () => {
      const result = await requestInvestigation({ concernId: selected.id, notes: investigationNotes.trim() });
      if (result.error) throw new Error(result.error);
      setInvestigationNotes("");
      setShowInvestigationModal(false);
    }).catch((e: Error) => {
      setInvestigationError(e.message);
    });
  }

  async function handleResolve() {
    if (!selected || !resolutionNotes.trim()) return;
    await handleAction(async () => {
      const result = await updateConcern(selected.id, {
        status: "resolved",
        resolutionNotes: resolutionNotes.trim(),
      });
      if (result.error) throw new Error(result.error);
      setResolutionNotes("");
      setShowResolutionModal(false);
    });
  }

  const filteredConcerns = concerns.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.subject.toLowerCase().includes(q) &&
        !c.concern_number.toLowerCase().includes(q) &&
        !c.customer?.full_name.toLowerCase().includes(q) &&
        !c.customer?.email?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bricolage text-xl font-semibold text-foreground sm:text-2xl">
              Complaints & Concerns
            </h1>
            <p className="mt-1 text-sm text-muted">Manage and resolve customer concerns</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-accent" />
          <span className="ml-3 text-sm text-muted">Loading concerns…</span>
        </div>
      </div>
    );
  }

  const stats = {
    total: filteredConcerns.length,
    open: filteredConcerns.filter(c => c.status === "open").length,
    inProgress: filteredConcerns.filter(c => c.status === "in_progress").length,
    resolved: filteredConcerns.filter(c => c.status === "resolved" || c.status === "closed").length,
    urgent: filteredConcerns.filter(c => c.priority === "high" && (c.status === "open" || c.status === "in_progress")).length,
  };
  const isFinal = selected?.status === "resolved" || selected?.status === "closed";
  const hasActiveInvestigation = selected?.timeline?.some(t => t.type === "investigation_requested") ?? false;

  return (
    <div className="mx-auto max-w-7xl space-y-5 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bricolage text-xl font-semibold text-foreground sm:text-2xl">
            Complaints & Concerns
          </h1>
          <p className="mt-1 text-sm text-muted">Manage and resolve customer concerns</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRefreshing(true); loadConcerns(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-background border border-line rounded-lg hover:bg-line/50 transition-colors disabled:opacity-60"
            title="Refresh"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</p>
          <button onClick={loadConcerns} className="text-sm text-red-600 hover:underline">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="In view" value={stats.total} />
        <StatCard label="Open" value={stats.open} tone="red" />
        <StatCard label="In Progress" value={stats.inProgress} tone="amber" />
        <StatCard label="Resolved" value={stats.resolved} tone="emerald" />
        <StatCard label="Urgent" value={stats.urgent} tone="red" />
      </div>

      {/* Filter toolbar */}
      <div className="rounded-lg border border-line bg-background p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-55">
          <label htmlFor="search" className="text-[11px] text-muted mb-1 block">Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              id="search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by subject, reference or customer…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded-lg outline-none focus:border-accent/50 placeholder:text-foreground/30"
            />
          </div>
        </div>
        <div className="w-36">
          <label htmlFor="statusFilter" className="text-[11px] text-muted mb-1 block">Status</label>
          <select id="statusFilter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="w-36">
          <label htmlFor="priorityFilter" className="text-[11px] text-muted mb-1 block">Priority</label>
          <select id="priorityFilter" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className={selectCls}>
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="w-40">
          <label htmlFor="assignmentFilter" className="text-[11px] text-muted mb-1 block">Assignment</label>
          <select id="assignmentFilter" value={assignmentFilter} onChange={e => setAssignmentFilter(e.target.value)} className={selectCls}>
            <option value="all">All</option>
            <option value="me">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
        {/* Concern queue (table) */}
        <div className="xl:col-span-3 rounded-lg border border-line bg-background overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Queue</p>
            <p className="text-xs text-muted">
              {filteredConcerns.length} concern{filteredConcerns.length !== 1 ? "s" : ""}
            </p>
          </div>

          {filteredConcerns.length === 0 ? (
            <div className="p-10 text-center">
              <Package size={24} className="mx-auto text-muted mb-2" />
              <p className="text-sm text-muted">No concerns found</p>
              {search && <p className="text-xs text-muted mt-1">Try adjusting your search or filters</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2 font-semibold">Concern</th>
                    <th className="px-3 py-2 font-semibold">Priority</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Assignee</th>
                    <th className="px-4 py-2 font-semibold text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredConcerns.map(c => {
                    const active = selected?.id === c.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => loadConcernDetail(c.id)}
                        className={`cursor-pointer transition-colors hover:bg-line/30 ${active ? "bg-line/40" : ""}`}
                      >
                        <td className={`px-4 py-3 border-l-2 ${active ? "border-l-accent" : "border-l-transparent"}`}>
                          <p className="font-medium text-foreground leading-snug line-clamp-1">{c.subject}</p>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] text-muted">{c.concern_number}</span>
                            <CategoryBadge category={c.category} />
                            {c.customer?.full_name && (
                              <span className="text-[11px] text-muted">· {c.customer.full_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3"><PriorityBadge priority={c.priority} /></td>
                        <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-3 py-3">
                          {c.assigned_to_profile ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                              <Avatar name={c.assigned_to_profile.full_name ?? c.assigned_to_profile.email ?? "Staff"} size={20} />
                              <span className="truncate min-w-55">
                                {c.assigned_to_profile.full_name ?? c.assigned_to_profile.email}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted whitespace-nowrap">{formatShortDate(c.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Concern detail */}
        <div className="xl:col-span-2 space-y-4">
          {selected ? (
            <>
              {/* Header + actions */}
              <div className="bg-background border border-line rounded-lg p-4 space-y-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={selected.status} />
                    <PriorityBadge priority={selected.priority} />
                    <CategoryBadge category={selected.category} />
                  </div>
                  <h2 className="font-bricolage text-lg font-semibold text-foreground mt-2 leading-snug">{selected.subject}</h2>
                  <p className="font-mono text-xs text-muted mt-0.5">{selected.concern_number}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setShowCustomerUpdateModal(true)} className={accentBtn}>
                    <Send size={13} /> Reply to Customer
                  </button>
                  <button onClick={() => setShowInternalNoteModal(true)} className={ghostBtn}>
                    <MessageSquare size={13} /> Internal Note
                  </button>
                  <button onClick={() => setShowStatusModal(true)} className={ghostBtn}>
                    <Edit size={13} /> Change Status
                  </button>
                  <button onClick={() => setShowAssignModal(true)} className={ghostBtn}>
                    <User size={13} /> Assign
                  </button>
                  {!isFinal && (
                    <button
                      onClick={() => setShowResolutionModal(true)}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={13} /> Resolve
                    </button>
                  )}
                  {!isFinal && !hasActiveInvestigation && (
                    <button
                      onClick={() => { setInvestigationError(null); setShowInvestigationModal(true); }}
                      className="px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors inline-flex items-center gap-1.5"
                    >
                      <SearchCode size={13} /> Request Investigation
                    </button>
                  )}
                  {hasActiveInvestigation && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg">
                      <SearchCode size={13} /> Investigation Requested
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
                  <Field label="Customer">
                    {selected.customer ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={selected.customer.full_name} size={22} />
                        <span className="min-w-0">
                          <span className="block truncate">{selected.customer.full_name}</span>
                          <span className="block text-[11px] text-muted truncate">{selected.customer.email}</span>
                        </span>
                      </span>
                    ) : "—"}
                  </Field>
                  <Field label="Assigned To">
                    {selected.assigned_to_profile ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={selected.assigned_to_profile.full_name ?? selected.assigned_to_profile.email ?? "Staff"} size={22} />
                        <span className="truncate">{selected.assigned_to_profile.full_name ?? selected.assigned_to_profile.email}</span>
                      </span>
                    ) : (
                      <span className="text-muted italic">Unassigned</span>
                    )}
                  </Field>
                  <Field label="Created">{formatDateTime(selected.created_at)}</Field>
                  <Field label="Last Updated">{formatDateTime(selected.updated_at)}</Field>
                  {selected.shipment && (
                    <>
                      <Field label="Shipment">
                        <span className="flex items-center gap-1.5 font-mono">
                          <Package size={12} className="text-muted" />{selected.shipment.request_id}
                        </span>
                      </Field>
                      <Field label="Shipment Status">{selected.shipment.status}</Field>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <SectionCard title="Description">
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.description}</p>
              </SectionCard>

              {/* Resolution */}
              {selected.resolution_notes && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-1">Resolution</p>
                  <p className="text-sm text-emerald-900 dark:text-emerald-100">{selected.resolution_notes}</p>
                  {selected.resolved_at && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
                      Resolved: {formatDateTime(selected.resolved_at)}
                    </p>
                  )}
                  {selected.status !== "resolved" && selected.status !== "closed" && (
                    <button
                      onClick={() => setShowResolutionModal(true)}
                      className="mt-2 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Mark as Resolved
                    </button>
                  )}
                </div>
              )}

              {/* Customer Updates */}
              <SectionCard
                title="Customer Updates"
                action={
                  <button onClick={() => setShowCustomerUpdateModal(true)} className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1">
                    <Plus size={12} /> Add
                  </button>
                }
              >
                {(selected.customerUpdates && selected.customerUpdates.length > 0) ? (
                  <div className="space-y-3">
                    {selected.customerUpdates.map(update => (
                      <div key={update.id} className="flex gap-3">
                        <TimelineDot type="update" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{update.text}</p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {update.author} · {formatDateTime(update.time)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted text-center py-2">No customer updates yet</p>
                )}
              </SectionCard>

              {/* Internal Notes */}
              <SectionCard
                title="Internal Notes · Staff Only"
                action={
                  <button onClick={() => setShowInternalNoteModal(true)} className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1">
                    <Plus size={12} /> Add
                  </button>
                }
              >
                <div className="space-y-3">
                  {(selected.internalNotes && selected.internalNotes.length > 0) ? (
                    selected.internalNotes.map(note => (
                      <div key={note.id} className="flex gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 rounded-lg p-3">
                        <TimelineDot type="internal_note" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{note.text}</p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {note.author} · {formatDateTime(note.time)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted text-center py-2">No internal notes yet</p>
                  )}
                </div>
              </SectionCard>

              {/* Timeline */}
              {(selected.timeline && selected.timeline.length > 0) && (
                <SectionCard title="Timeline">
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {selected.timeline.map(entry => (
                      <div key={entry.id} className="flex gap-3">
                        <TimelineDot type={entry.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{entry.text}</p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {entry.author} · {formatDateTime(entry.time)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </>
          ) : (
            <div className="bg-background border border-line rounded-lg flex flex-col items-center justify-center text-muted min-h-100">
              <Package size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Select a concern to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCustomerUpdateModal && (
        <Modal
          title="Reply to Customer"
          description="This update will be visible to the customer."
          onClose={() => setShowCustomerUpdateModal(false)}
        >
          <textarea
            value={customerUpdateText}
            onChange={e => setCustomerUpdateText(e.target.value)}
            placeholder="Enter update for customer…"
            rows={4}
            className={`${inputCls} mb-4`}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCustomerUpdateModal(false)} className={ghostBtn}>Cancel</button>
            <button onClick={handleAddCustomerUpdate} disabled={submitting || !customerUpdateText.trim()} className={accentBtn}>
              {submitting && <Loader2 size={13} className="animate-spin" />} Add Update
            </button>
          </div>
        </Modal>
      )}

      {showInternalNoteModal && (
        <Modal
          title="Add Internal Note"
          description="Internal notes are only visible to staff."
          onClose={() => setShowInternalNoteModal(false)}
        >
          <textarea
            value={internalNoteText}
            onChange={e => setInternalNoteText(e.target.value)}
            placeholder="Enter internal note…"
            rows={4}
            className={`${inputCls} mb-4`}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowInternalNoteModal(false)} className={ghostBtn}>Cancel</button>
            <button onClick={handleAddInternalNote} disabled={submitting || !internalNoteText.trim()} className={accentBtn}>
              {submitting && <Loader2 size={13} className="animate-spin" />} Add Note
            </button>
          </div>
        </Modal>
      )}

      {showStatusModal && (
        <Modal title="Change Status" onClose={() => setShowStatusModal(false)}>
          <select
            value={newStatus}
            onChange={e => setNewStatus(e.target.value as ConcernStatus)}
            className={`${selectCls} mb-4`}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowStatusModal(false)} className={ghostBtn}>Cancel</button>
            <button onClick={handleStatusChange} disabled={submitting} className={accentBtn}>
              {submitting && <Loader2 size={13} className="animate-spin" />} Update Status
            </button>
          </div>
        </Modal>
      )}

      {showAssignModal && (
        <Modal title="Assign Concern" onClose={() => setShowAssignModal(false)}>
          <select
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            className={`${selectCls} mb-4`}
          >
            <option value="">Unassigned</option>
            {/* TODO: Fetch staff list from API */}
            <option value="current">Assign to Me</option>
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAssignModal(false)} className={ghostBtn}>Cancel</button>
            <button onClick={handleAssign} disabled={submitting} className={accentBtn}>
              {submitting && <Loader2 size={13} className="animate-spin" />} Assign
            </button>
          </div>
        </Modal>
      )}

      {showResolutionModal && (
        <Modal
          title="Resolve Concern"
          description="Resolution notes are required and will be visible to the customer."
          onClose={() => setShowResolutionModal(false)}
        >
          <textarea
            value={resolutionNotes}
            onChange={e => setResolutionNotes(e.target.value)}
            placeholder="Enter resolution details…"
            rows={4}
            className={`${inputCls} mb-4`}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowResolutionModal(false)} className={ghostBtn}>Cancel</button>
            <button
              onClick={handleResolve}
              disabled={submitting || !resolutionNotes.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />} Resolve
            </button>
          </div>
        </Modal>
      )}

      {showInvestigationModal && selected && (
        <Modal
          title="Request Investigation"
          description="This will log a referral to Freight Operations. The concern status will not change."
          onClose={() => { setShowInvestigationModal(false); setInvestigationError(null); }}
        >
          <div className="space-y-3 mb-4">
            <div className="rounded-lg bg-foreground/5 border border-line p-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="text-muted w-28 shrink-0">Concern ID</span>
                <span className="font-mono text-foreground">{selected.concern_number}</span>
              </div>
              {selected.shipment && (
                <div className="flex gap-2">
                  <span className="text-muted w-28 shrink-0">Shipment Ref</span>
                  <span className="font-mono text-foreground">{selected.shipment.request_id}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-muted w-28 shrink-0">Category</span>
                <CategoryBadge category={selected.category} />
              </div>
              <div className="flex gap-2">
                <span className="text-muted w-28 shrink-0">Subject</span>
                <span className="text-foreground line-clamp-2">{selected.subject}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Investigation Notes <span className="text-red-500">*</span></label>
              <textarea
                value={investigationNotes}
                onChange={e => setInvestigationNotes(e.target.value)}
                placeholder="Describe what needs to be investigated by Freight Operations…"
                rows={4}
                className={inputCls}
                autoFocus
              />
            </div>
            {investigationError && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle size={13} /> {investigationError}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowInvestigationModal(false); setInvestigationError(null); }} className={ghostBtn}>Cancel</button>
            <button
              onClick={handleRequestInvestigation}
              disabled={submitting || !investigationNotes.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              <SearchCode size={13} /> Confirm Request
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}