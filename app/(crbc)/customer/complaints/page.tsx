"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, CheckCircle2, Clock, XCircle, Plus, Package, X, Loader2, Send, RefreshCw } from "lucide-react";
import { PageHeader, Panel, EmptyState, PrimaryButton, Input, Textarea, Select, SelectOption, Avatar } from "../../components/customer/PortalUI";
import { createConcern, getCustomerConcerns, getConcernDetail } from "../../actions/concern";
import type { Concern, ConcernCategory, ConcernStatus } from "../../types/concern";

const CATEGORIES: { value: ConcernCategory; label: string; requiresRef: boolean }[] = [
  { value: "delivery", label: "Delivery Issue", requiresRef: true },
  { value: "wrong_item", label: "Wrong Item", requiresRef: true },
  { value: "damaged", label: "Damaged Item", requiresRef: true },
  { value: "billing", label: "Billing Inquiry", requiresRef: false },
  { value: "other", label: "Other", requiresRef: false },
];

const STATUS_STYLE: Record<ConcernStatus, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  open: { label: "Open", bg: "bg-red-50 dark:bg-red-950/40", color: "text-red-600 dark:text-red-400", icon: <AlertCircle size={11} /> },
  in_progress: { label: "In Progress", bg: "bg-amber-50 dark:bg-amber-950/40", color: "text-amber-600 dark:text-amber-400", icon: <Clock size={11} /> },
  resolved: { label: "Resolved", bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-600 dark:text-emerald-400", icon: <CheckCircle2 size={11} /> },
  closed: { label: "Closed", bg: "bg-line/60", color: "text-muted", icon: <XCircle size={11} /> },
};

const PRIORITY_STYLE: Record<"high" | "medium" | "low", { label: string; bg: string; color: string; dot: string }> = {
  high: { label: "High", bg: "bg-red-50 dark:bg-red-950/40", color: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  medium: { label: "Medium", bg: "bg-amber-50 dark:bg-amber-950/40", color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  low: { label: "Low", bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
};

function StatusBadge({ status }: { status: ConcernStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: ConcernCategory }) {
  const cat = CATEGORIES.find(c => c.value === category);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/60">
      {cat?.label ?? category}
    </span>
  );
}

function TimelineDot({ type }: { type: string }) {
  const cls = type === "resolved" || type === "closed" ? "bg-emerald-500"
    : type === "created" ? "bg-accent"
    : type === "assigned" ? "bg-violet-500"
    : "bg-foreground/20";
  return <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cls}`} />;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true
  });
}

export default function CustomerComplaintsPage() {
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [selected, setSelected] = useState<Concern | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    subject: "",
    category: "delivery" as ConcernCategory,
    shipmentId: "",
    description: "",
  });
  const [formError, setFormError] = useState("");

  const selectedCategory = CATEGORIES.find(c => c.value === form.category)!;
  const refRequired = selectedCategory.requiresRef;

  // Used by Retry / Refresh (event handlers), so setState here is fine.
  const loadConcerns = useCallback(async () => {
    try {
      const result = await getCustomerConcerns();
      if (result.error) throw new Error(result.error);
      setError(null);
      setConcerns(result.concerns);
      setSelected(prev => prev ?? result.concerns[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load concerns");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function loadConcernDetail(concernId: string) {
    const result = await getConcernDetail(concernId);
    if (!result.error && result.concern) {
      setSelected(result.concern);
    }
  }

  // Initial load: every setState happens after an await, not synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getCustomerConcerns();
        if (cancelled) return;
        if (result.error) {
          setError(result.error);
        } else {
          setConcerns(result.concerns);
          setSelected(prev => prev ?? result.concerns[0] ?? null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load concerns");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    if (!form.subject.trim() || !form.description.trim()) {
      setFormError("Subject and description are required.");
      setSubmitting(false);
      return;
    }
    if (refRequired && !form.shipmentId.trim()) {
      setFormError("A Shipment Reference ID is required for this category.");
      setSubmitting(false);
      return;
    }

    const result = await createConcern({
      subject: form.subject.trim(),
      category: form.category,
      shipmentId: form.shipmentId.trim() || undefined,
      description: form.description.trim(),
    });

    if (result.error) {
      setFormError(result.error);
      setSubmitting(false);
      return;
    }

    setConcerns(prev => [result.concern!, ...prev]);
    setSelected(result.concern!);
    setForm({ subject: "", category: "delivery", shipmentId: "", description: "" });
    setShowForm(false);
    setSubmitting(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadConcerns();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 py-6">
        <PageHeader
          title="Complaints & Concerns"
          description="Submit and track your concerns. We aim to respond within 24–48 hours."
        />
        <Panel>
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-accent" />
            <span className="ml-3 text-sm text-muted">Loading your concerns…</span>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 py-6">
      <PageHeader
        title="Complaints & Concerns"
        description="Submit and track your concerns. We aim to respond within 24–48 hours."
        action={
          <PrimaryButton
            onClick={() => setShowForm(v => !v)}
            disabled={submitting}
            className="text-sm"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Cancel" : "File a Concern"}
          </PrimaryButton>
        }
      />

      {error && (
        <Panel className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40">
          <div className="px-5 py-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button onClick={handleRefresh} className="ml-auto text-sm text-red-600 hover:underline">
              Retry
            </button>
          </div>
        </Panel>
      )}

      {/* Submit form */}
      {showForm && (
        <Panel title="File a new concern" className="space-y-4">
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {formError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="subject" className="text-xs text-muted mb-1 block">Subject</label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="Brief summary of your concern"
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="category" className="text-xs text-muted mb-1 block">Category</label>
                <Select
                  id="category"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value as ConcernCategory })}
                  disabled={submitting}
                >
                  {CATEGORIES.map(c => (
                    <SelectOption key={c.value} value={c.value}>{c.label}</SelectOption>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="shipmentId" className="text-xs text-muted mb-1 block">
                  Shipment Reference ID {refRequired && <span className="text-red-500">*</span>}
                </label>
                <Input
                  id="shipmentId"
                  value={form.shipmentId}
                  onChange={e => setForm({ ...form, shipmentId: e.target.value })}
                  placeholder={refRequired ? "Required (e.g., REQ-0123)" : "Optional (e.g., REQ-0123)"}
                  disabled={submitting}
                />
                {refRequired && (
                  <p className="mt-1 text-[11px] text-muted">Required for Delivery, Wrong Item, and Damaged categories.</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="text-xs text-muted mb-1 block">Description</label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Describe your concern in detail. Include dates, tracking numbers, and any relevant information."
                rows={5}
                disabled={submitting}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-line rounded-lg hover:bg-line/50 transition-colors"
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={submitting} className="text-sm">
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1" /> Submitting…
                  </>
                ) : (
                  <>
                    <Send size={14} className="mr-1" /> Submit Concern
                  </>
                )}
              </PrimaryButton>
            </div>
          </form>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Concern list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted px-1">Your Concerns</p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
          {concerns.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<Package size={16} />}
                title="No concerns yet"
                description="File a concern and we will get back to you within 24–48 hours."
              />
            </Panel>
          ) : (
            <div className="rounded-lg border border-line bg-background overflow-hidden divide-y divide-line">
              {concerns.map(c => (
                <button
                  key={c.id}
                  onClick={() => loadConcernDetail(c.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-line/30 ${selected?.id === c.id ? "bg-line/40 border-l-2 border-l-accent" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug flex-1">{c.subject}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="font-mono text-[11px] text-muted">{c.concern_number}</span>
                    <CategoryBadge category={c.category} />
                    <span className="text-[11px] text-muted">· {formatDateTime(c.created_at)}</span>
                  </div>
                  {c.shipment && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                      <Package size={10} />
                      <span className="font-mono">{c.shipment.request_id}</span>
                      <span>({c.shipment.status})</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Concern detail */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <Panel
              title={selected.subject}
              action={
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <PriorityBadge priority={selected.priority} />
                </div>
              }
            >
              <div className="px-5 py-4 space-y-4">
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted text-xs">Reference</p>
                    <p className="font-mono text-foreground">{selected.concern_number}</p>
                  </div>
                  <div>
                    <p className="text-muted text-xs">Category</p>
                    <CategoryBadge category={selected.category} />
                  </div>
                  <div>
                    <p className="text-muted text-xs">Submitted</p>
                    <p className="text-foreground">{formatDateTime(selected.created_at)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted text-xs">Last Updated</p>
                    <p className="text-foreground">{formatDateTime(selected.updated_at)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted text-xs">Status</p>
                    <StatusBadge status={selected.status} />
                  </div>
                  {selected.assigned_to_profile && (
                    <div className="sm:col-span-2">
                      <p className="text-muted text-xs">Assigned To</p>
                      <p className="text-foreground flex items-center gap-2">
                        <Avatar name={selected.assigned_to_profile.full_name || "Staff"} size={20} />
                        {selected.assigned_to_profile.full_name}
                      </p>
                    </div>
                  )}
                  {selected.shipment && (
                    <>
                      <div>
                        <p className="text-muted text-xs">Shipment</p>
                        <p className="font-mono text-foreground">{selected.shipment.request_id}</p>
                      </div>
                      <div>
                        <p className="text-muted text-xs">Shipment Status</p>
                        <p className="text-foreground">{selected.shipment.status}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-line pt-4">
                  <p className="text-xs text-muted mb-2">Description</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selected.description}</p>
                </div>

                {selected.customerUpdates && selected.customerUpdates.length > 0 && (
                  <div className="border-t border-line pt-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Updates</p>
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
                  </div>
                )}

                {selected.timeline && selected.timeline.length > 0 && (
                  <div className="border-t border-line pt-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Timeline</p>
                    <div className="space-y-3">
                      {selected.timeline
                        .filter(t => t.type !== "customer_update")
                        .map(entry => (
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
                  </div>
                )}

                {selected.resolution_notes && (
                  <div className="border-t border-emerald-200 dark:border-emerald-800 pt-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-1">Resolution</p>
                    <p className="text-sm text-emerald-900 dark:text-emerald-100">{selected.resolution_notes}</p>
                    {selected.resolved_at && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
                        Resolved: {formatDateTime(selected.resolved_at)}
                      </p>
                    )}
                  </div>
                )}

                {selected.status === "closed" && (
                  <div className="border-t border-line pt-4 text-center">
                    <p className="text-sm text-muted">This concern has been closed.</p>
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <Panel>
              <EmptyState
                icon={<Package size={16} />}
                title="Select a concern"
                description="Choose a concern from the list to view details, updates, and timeline."
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}