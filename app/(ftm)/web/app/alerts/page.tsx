"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";
import { getAlertHistory, getAlerts, updateAlertStatus } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

// Types & Data Definitions
type AlertTab = "overview" | "active" | "maintenance" | "safety" | "history";
type Severity = "critical" | "high" | "medium" | "low";

interface ActiveAlert {
  id: string;
  title: string;
  reason: string;
  severity: Severity;
  label: string;
  subsystem: string;
  time: string;
  vessel: string;
  message: string;
  actions: Array<"acknowledge" | "details" | "ticket">;
  status?: string;
  category?: string;
  actionUrl?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  driverId?: string | null;
  tripId?: string | null;
}
interface MaintenanceCard {
  id: string;
  status: "overdue" | "upcoming" | "routine";
  statusLabel: string;
  due: string;
  title: string;
  description: string;
  vessel: string;
  wide?: boolean;
  actionUrl?: string | null;
}

interface SafetyEvent {
  id: string;
  icon: string;
  title: string;
  time: string;
  severity: Severity;
  vehicle: string;
  driver: string;
  location: string;
  actionUrl?: string | null;
  detail: {
    incidentType: string;
    incidentDescription: string;
    speedBefore?: string;
    speedAfter?: string;
    driverName: string;
    driverId: string;
    absActivation: string;
    weather: string;
    loadStatus: string;
    coordinates: string;
  };
}

interface HistoryRow {
  id: string;
  alertId?: string;
  timestamp: string;
  subsystem:
    | "FVM"
    | "Fuel"
    | "VRDS"
    | "Dispatch"
    | "Tracking"
    | "Bulk Handling"
    | "Fleet"
    | "Safety"
    | "Notifications";
  description: string;
  severity: Severity;
  ttr: string;
}

interface CanonicalAlertRecord {
  id: string;
  alert_type?: string | null;
  category?: string | null;
  severity?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  vehicle_id?: string | null;
  driver_id?: string | null;
  trip_id?: string | null;
  created_at?: string | null;
  action_required?: boolean | null;
  metadata?: Record<string, unknown> | null;
  action_url?: string | null;
  source_type?: string | null;
  source_id?: string | null;
}

function mapCanonicalAlert(alert: CanonicalAlertRecord): ActiveAlert {
  const severity = String(alert.severity || "MEDIUM").toLowerCase() as Severity;
  const label = severity === "critical" ? "Critical" : severity === "high" ? "High" : severity === "medium" ? "Medium" : "Low";
  const metadataReason = typeof alert.metadata?.reason === "string" ? alert.metadata.reason : null;
  const reason = metadataReason || alert.message || (alert.alert_type ? `${alert.alert_type.replace(/_/g, " ")} was reported.` : "The source event did not provide a reason.");
  return {
    id: alert.id,
    title: alert.title || alert.alert_type || "Operational alert",
    reason,
    severity,
    label,
    subsystem: alert.category || alert.alert_type || "Operations",
    time: alert.created_at ? new Date(alert.created_at).toLocaleString() : "Recent",
    vessel: alert.vehicle_id || (alert.trip_id ? `Trip ${alert.trip_id}` : "Operational Unit"),
    message: alert.message || alert.title || "Alert details are unavailable.",
    actions: severity === "critical" ? ["acknowledge", "details", "ticket"] : ["acknowledge", "details"],
    status: alert.status,
    category: alert.category,
    actionUrl: alert.action_url || (alert.category === "MAINTENANCE" ? "/fvm/maintenance" : alert.category === "SAFETY" ? "/driver/safety" : alert.category === "FLEET" ? "/fvm" : "/vrds/bookings"),
    sourceType: alert.source_type,
    sourceId: alert.source_id,
    driverId: alert.driver_id,
    tripId: alert.trip_id,
  };
}

// Styling Helper Mappings
const severityBadge: Record<Severity, string> = {
  critical: "bg-rose-100 text-rose-700 border-rose-200",
  high: "bg-pink-100 text-pink-700 border-pink-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

const severityBorder: Record<Severity, string> = {
  critical: "border-l-rose-500",
  high: "border-l-pink-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-400",
};

// Root Component
export default function AlertsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50/50 p-6"><div className="mx-auto max-w-[1800px] animate-pulse space-y-5"><div className="h-10 w-64 rounded-lg bg-slate-200" /><div className="h-24 rounded-2xl bg-white" /><div className="grid gap-5 md:grid-cols-2"><div className="h-40 rounded-2xl bg-white" /><div className="h-40 rounded-2xl bg-white" /></div></div></main>}>
      <AlertsPageContent />
    </Suspense>
  );
}
function AlertsPageContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: AlertTab = requestedTab === "active" || requestedTab === "maintenance" || requestedTab === "safety" || requestedTab === "history"
    ? requestedTab
    : "overview";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-800 font-sans selection:bg-pink-500 selection:text-white">
      <GlobalNavbar />

      {/* Main Content Area - Maximized Width */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {tab === "overview" && <MonitoringHub />}
        {tab === "active" && <ActiveAlerts />}
        {tab === "maintenance" && <MaintenanceNotifications />}
        {tab === "safety" && <SafetyEventsView />}
        {tab === "history" && <SystemHistoryView />}
      </main>

      {/* Footer */}
      <GlobalFooter />
    </div>
  );
}

function MonitoringHub() {
  const cards = [
    {
      href: "/alerts?tab=active",
      icon: "warning",
      title: "Active Alerts",
      description: "Review current operational alerts.",
      accent: "border-rose-200 hover:border-rose-400 hover:bg-rose-50/60",
      iconTone: "bg-rose-100 text-rose-600",
    },
    {
      href: "/alerts?tab=maintenance",
      icon: "build",
      title: "Maintenance Notifications",
      description: "Review maintenance notices.",
      accent: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/60",
      iconTone: "bg-amber-100 text-amber-600",
    },
    {
      href: "/alerts?tab=safety",
      icon: "health_and_safety",
      title: "Safety Events",
      description: "Inspect recent safety events.",
      accent: "border-pink-200 hover:border-pink-400 hover:bg-pink-50/60",
      iconTone: "bg-pink-100 text-pink-600",
    },
    {
      href: "/alerts?tab=history",
      icon: "history",
      title: "System History",
      description: "Review historical system events.",
      accent: "border-slate-200 hover:border-slate-400 hover:bg-slate-50",
      iconTone: "bg-slate-100 text-slate-600",
    },
  ];

  return (
    <section className="space-y-8">
      <AlertHero
        badge="FTM Alert Operations Hub"
        icon="notifications_active"
        title="Operational Alerts & Event Monitoring"
        description="Review active risks, maintenance readiness, safety events, and system history from one connected workspace."
      />

      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group rounded-2xl border bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 ${card.accent}`}
          >
            <div className="flex items-start justify-between gap-5">
              <span className={`material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${card.iconTone}`}>{card.icon}</span>
              <span className="material-symbols-outlined text-slate-300 transition group-hover:translate-x-1 group-hover:text-pink-500">arrow_forward</span>
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            <span className="mt-6 inline-flex items-center text-xs font-bold uppercase tracking-[0.16em] text-pink-600">Open monitoring view</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AlertHero({
  badge,
  icon,
  title,
  description,
  metrics = [],
}: {
  badge: string;
  icon: string;
  title: string;
  description: string;
  metrics?: Array<{ label: string; value: string; description: string; tone?: string }>;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-pink-200/80 bg-gradient-to-br from-white via-pink-50/40 to-pink-100/30 p-6 shadow-sm backdrop-blur-md md:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pink-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-pink-400/10 blur-3xl" />
      <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-100 px-3.5 py-1.5 text-xs font-semibold text-pink-700">
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
            {badge}
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">{title}</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">{description}</p>
        </div>
        {metrics.length > 0 && (
          <div className="grid w-full grid-cols-2 gap-3.5 lg:max-w-2xl xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-pink-100 bg-white/80 p-4 shadow-sm">
                <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">{metric.label}</span>
                <strong className={`mt-3 block text-3xl font-black ${metric.tone || "text-slate-900"}`}>{metric.value}</strong>
                <span className="mt-1 block text-xs text-slate-500">{metric.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Active Alerts Tab Component
function ActiveAlerts() {
  const PRIORITIES = ["All Priorities", "Critical", "High", "Medium", "Low"];
  const SUBSYSTEMS = [
    "All Subsystems",
    "Dispatch Dashboard",
    "Tracking Sync",
    "Bulk Handling",
    "Fleet Support",
  ];

  const [priority, setPriority] = useState(PRIORITIES[0]);
  const [subsystem, setSubsystem] = useState(SUBSYSTEMS[0]);
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals & Notices
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<ActiveAlert | null>(null);
  const [ticketTarget, setTicketTarget] = useState<ActiveAlert | null>(null);
  const [confirmAcknowledge, setConfirmAcknowledge] = useState<ActiveAlert | null>(null);

  useEffect(() => {
    let active = true;

    const loadAlerts = () => getAlerts({ status: "ACTIVE" })
      .then((items) => {
        if (!active) return;
        const mappedAlerts = (Array.isArray(items) ? items : []).map(mapCanonicalAlert);
        setAlerts(mappedAlerts);
        setLastUpdated(new Date().toLocaleString());
        setLoadError(null);
      })
      .catch((error) => {
        console.error("Failed to load alerts data:", error);
        if (active) {
          setAlerts([]);
          setLoadError("Unable to load alerts. Please try again.");
        }
      })
      .finally(() => {
      });

      void loadAlerts();
      const intervalId = window.setInterval(() => void loadAlerts(), 30000);
      const channel = supabase
        .channel("ftm-alerts-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => void loadAlerts())
        .subscribe();

    return () => {
      active = false;
      window.clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };
  }, []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const priorityMatch =
        priority === "All Priorities" || alert.label === priority;
      const subsystemMatch =
        subsystem === "All Subsystems" || alert.subsystem === subsystem;
      return priorityMatch && subsystemMatch;
    });
  }, [priority, subsystem, alerts]);

  const categoryChart = useMemo(() => {
    const counts = new Map<string, number>();
    alerts.forEach((alert) => {
      const category = alert.category || alert.subsystem || "Uncategorized";
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    const rows = Array.from(counts, ([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
    const max = rows[0]?.count || 1;
    return rows.map((row) => ({ ...row, width: `${Math.max(8, Math.round((row.count / max) * 100))}%` }));
  }, [alerts]);

  const confirmAcknowledgeNow = async (alert: ActiveAlert) => {
    try {
      await updateAlertStatus(alert.id, "ACKNOWLEDGED");
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      showNotice(`Alert ${alert.id} acknowledged.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to acknowledge alert.");
    } finally {
      setConfirmAcknowledge(null);
    }
  };

  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {noticeMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-pink-400" />
          <span className="text-sm font-medium">{noticeMessage}</span>
        </div>
      )}

      <AlertHero
        badge="FTM Active Alert Operations"
        icon="notifications_active"
        title="Active Operational Alerts"
        description={lastUpdated ? `Live alerts fetched from connected FTM modules. Updated ${lastUpdated}.` : "Live alerts fetched from connected FTM modules."}
        metrics={[
          { label: "Critical alerts", value: String(alerts.filter((alert) => alert.severity === "critical").length), description: "Immediate intervention", tone: "text-rose-600" },
          { label: "High alerts", value: String(alerts.filter((alert) => alert.severity === "high").length), description: "Important problems", tone: "text-pink-600" },
          { label: "Medium alerts", value: String(alerts.filter((alert) => alert.severity === "medium").length), description: "Require attention", tone: "text-amber-600" },
          { label: "Low alerts", value: String(alerts.filter((alert) => alert.severity === "low").length), description: "Minor issues", tone: "text-slate-600" },
        ]}
      />

      {/* Filter Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700">Alert filters</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-xl border border-pink-100 bg-pink-50/30 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-pink-500 focus:outline-none"
          >
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            value={subsystem}
            onChange={(e) => setSubsystem(e.target.value)}
            className="rounded-xl border border-pink-100 bg-pink-50/30 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-pink-500 focus:outline-none"
          >
            {SUBSYSTEMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <span className="text-xs font-medium text-slate-500">Live updates enabled</span>
      </div>

      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{loadError}</div>}

      {/* Wide Content Grid - Feed + Map */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Feed Column (7 cols) */}
        <div className="lg:col-span-7 overflow-hidden rounded-3xl border border-pink-200/80 bg-white shadow-sm">
          <div className="p-4 border-b border-pink-100 bg-pink-50/40 flex justify-between items-center">
            <h2 className="font-bold text-slate-900 text-sm tracking-wide">
              Live Delivery Stream
            </h2>
            <span className="text-xs font-semibold text-pink-600 bg-white px-2.5 py-1 rounded-full border border-pink-200">
              Showing {filteredAlerts.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredAlerts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No active alerts match your selected filters.
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-5 border-l-4 ${severityBorder[alert.severity]} hover:bg-pink-50/30 transition-all group`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${severityBadge[alert.severity]}`}
                      >
                        {alert.label}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {alert.subsystem}
                      </span>
                      <span className="text-xs text-slate-400">
                        • {alert.time}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      {alert.vessel}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-800 my-3 leading-relaxed">
                    <span className="block font-bold text-slate-900">{alert.title}</span>
                    <span className="mt-1 block"><span className="font-semibold text-slate-500">Reason:</span> {alert.reason}</span>
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    {alert.actions.includes("acknowledge") && (
                      <button
                        type="button"
                        onClick={() => setConfirmAcknowledge(alert)}
                        className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-sm shadow-pink-200"
                      >
                        Acknowledge
                      </button>
                    )}
                    {alert.actions.includes("details") && (
                      <button
                        type="button"
                        onClick={() => setDetailsTarget(alert)}
                        className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl transition-all"
                      >
                        Details
                      </button>
                    )}
                    {alert.actions.includes("ticket") && (
                      <button
                        type="button"
                        onClick={() => setTicketTarget(alert)}
                        className="text-pink-600 hover:text-pink-700 text-xs font-semibold px-2 py-1.5 hover:underline"
                      >
                        + Create Ticket
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live alert distribution chart */}
        <div className="lg:col-span-5 min-h-[450px] rounded-3xl border border-pink-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-pink-100 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Active alerts by category</h2>
              <p className="mt-1 text-xs text-slate-500">Calculated from the currently fetched active alerts.</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600">Live data</span>
          </div>

          {categoryChart.length === 0 ? (
            <div className="flex h-[360px] items-center justify-center text-center text-sm text-slate-500">
              No active alert data is available for this chart.
            </div>
          ) : (
            <div className="space-y-5 pt-6">
              {categoryChart.map((row) => (
                <div key={row.category}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                    <span className="font-semibold text-slate-700">{row.category}</span>
                    <span className="font-bold text-slate-900">{row.count}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100" aria-label={`${row.category}: ${row.count} active alerts`}>
                    <div className="h-full rounded-full bg-pink-500 transition-all duration-500" style={{ width: row.width }} />
                  </div>
                </div>
              ))}
              <div className="mt-8 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 text-xs">
                <div className="rounded-xl bg-pink-50 p-3"><span className="block text-slate-500">Total active</span><strong className="text-lg text-slate-900">{alerts.length}</strong></div>
                <div className="rounded-xl bg-amber-50 p-3"><span className="block text-slate-500">Action required</span><strong className="text-lg text-slate-900">{alerts.filter((alert) => alert.actions.includes("acknowledge")).length}</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {confirmAcknowledge && (
        <Modal title="Confirm Acknowledgment" onClose={() => setConfirmAcknowledge(null)}>
          <p className="text-sm text-slate-600 mb-6">
            Are you sure you want to acknowledge alert{" "}
            <strong className="text-slate-900">{confirmAcknowledge.id}</strong>?
            This will mark it as acknowledged while keeping it in the alert history.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmAcknowledge(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmAcknowledgeNow(confirmAcknowledge)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-pink-600 hover:bg-pink-700 text-white shadow-md shadow-pink-200"
            >
              Confirm Acknowledge
            </button>
          </div>
        </Modal>
      )}

      {detailsTarget && (
        <Modal title={`Alert Details: ${detailsTarget.id}`} onClose={() => setDetailsTarget(null)}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Reason for alert
              </span>
              <p className="text-sm font-medium text-slate-800">{detailsTarget.reason}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100">
                <span className="text-slate-400 block mb-0.5">Subsystem</span>
                <span className="font-semibold text-slate-800">{detailsTarget.subsystem}</span>
              </div>
              <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100">
                <span className="text-slate-400 block mb-0.5">Vessel Target</span>
                <span className="font-semibold text-slate-800">{detailsTarget.vessel}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Source</span>
                <span className="font-semibold text-slate-800">{detailsTarget.sourceType || "System event"}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Source ID</span>
                <span className="font-semibold text-slate-800 break-all">{detailsTarget.sourceId || detailsTarget.id}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            {detailsTarget.actionUrl && <Link href={detailsTarget.actionUrl} className="mr-3 rounded-xl bg-pink-600 px-4 py-2 text-xs font-semibold text-white hover:bg-pink-700">Open source module</Link>}
            <button
              onClick={() => setDetailsTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {ticketTarget && (
        <Modal title={`Create Ticket for ${ticketTarget.id}`} onClose={() => setTicketTarget(null)}>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Ticket Title"
              defaultValue={`Issue Resolution: ${ticketTarget.id}`}
              className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-pink-500"
            />
            <textarea
              placeholder="Resolution Details & Operator Notes"
              rows={3}
              className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-pink-500"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setTicketTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setTicketTarget(null);
                showNotice(`Ticket created for ${ticketTarget.id}`);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-pink-600 hover:bg-pink-700 text-white shadow-md shadow-pink-200"
            >
              Submit Ticket
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Maintenance View Component
function MaintenanceNotifications() {
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceCard[]>([]);

  useEffect(() => {
    let active = true;

    getAlerts({ category: "MAINTENANCE" })
      .then((items) => {
        if (!active) return;

        const maintenanceNotes = items
          .slice(0, 4)
          .map((item) => {
            const statusType: MaintenanceCard["status"] = String(item.alert_type ?? "").toLowerCase().includes("overdue")
              ? "overdue"
              : String(item.severity ?? "").toLowerCase() === "info"
              ? "routine"
              : "upcoming";

            return {
              id: item.id,
              status: statusType,
              statusLabel: item.status ?? item.alert_type ?? "Maintenance",
              due: item.created_at
                ? `Created ${new Date(item.created_at).toLocaleDateString()}`
                : "Scheduled soon",
              title: item.title ?? "Maintenance update",
              description: item.message ?? "Review maintenance alert details.",
              vessel: item.vehicle_id ?? "Maintenance",
              actionUrl: item.action_url || "/fvm/maintenance",
            };
          });

        setMaintenanceItems(maintenanceNotes);
      })
      .catch((error) => {
        console.error("Failed to load maintenance notifications:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <AlertHero
        badge="FTM Fleet Maintenance"
        icon="build"
        title="Maintenance Notifications"
        description="Review due, overdue, and vehicle service alerts from the connected fleet maintenance records."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {maintenanceItems.length === 0 ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">No maintenance notifications.</div>
        ) : maintenanceItems.map((card, idx) => (
          <div
            key={idx}
            className={`bg-white p-6 rounded-2xl border border-pink-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
              card.wide ? "md:col-span-2" : ""
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                    card.status === "overdue"
                      ? "bg-rose-100 text-rose-700 border-rose-200"
                      : "bg-pink-100 text-pink-700 border-pink-200"
                  }`}
                >
                  {card.statusLabel}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {card.vessel}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">
                {card.title}
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                <span className="font-semibold text-slate-500">Reason:</span> {card.description}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">{card.due}</span>
              <Link href={card.actionUrl || "/fvm/maintenance"} className="text-pink-600 font-semibold hover:underline">
                Open maintenance →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Safety Events Component
function SafetyEventsView() {
  const [safetyEventItems, setSafetyEventItems] = useState<SafetyEvent[]>([]);

  useEffect(() => {
    let active = true;

    getAlerts({ category: "SAFETY" })
      .then((incidents) => {
        if (!active) return;

        const liveEvents = (incidents as CanonicalAlertRecord[]).slice(0, 4).map((incident) => ({
          id: incident.id,
          icon:
            String(incident.alert_type || "").toUpperCase().includes("ACCIDENT")
              ? "car_crash"
              : String(incident.alert_type || "").toUpperCase().includes("BREAKDOWN")
              ? "speed"
              : "route",
          title: incident.title || "Safety Incident",
          time: incident.created_at
            ? new Date(incident.created_at).toLocaleString()
            : "Recent",
          severity: String(incident.severity || "MEDIUM").toLowerCase() as Severity,
          vehicle: incident.vehicle_id || "Vehicle unavailable",
          driver: incident.driver_id || "Driver unavailable",
          location: typeof incident.metadata?.location === "string" ? incident.metadata.location : "Location unavailable",
          actionUrl: incident.action_url || "/driver/safety",
          detail: {
            incidentType: incident.alert_type,
            incidentDescription: incident.message,
            driverName: incident.driver_id || "Driver unavailable",
            driverId: incident.driver_id || "Driver unavailable",
            absActivation: "Unavailable",
            weather: "Unavailable",
            loadStatus: "Unavailable",
            coordinates: typeof incident.metadata?.latitude === "number" && typeof incident.metadata?.longitude === "number"
              ? `${incident.metadata.latitude}, ${incident.metadata.longitude}`
              : "Location unavailable",
          },
        }));

        setSafetyEventItems(liveEvents);
      })
      .catch((error) => {
        console.error("Failed to load safety events:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <AlertHero
        badge="FTM Safety Operations"
        icon="health_and_safety"
        title="Safety Events & Incident Logs"
        description="Review driver-reported incidents, vehicle breakdowns, route issues, and other connected safety events."
      />

      <div className="grid grid-cols-1 gap-4">
        {safetyEventItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">No safety events recorded.</div>
        ) : safetyEventItems.map((evt) => (
          <div
            key={evt.id}
            className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm flex flex-col md:flex-row justify-between gap-6"
          >
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-pink-700 bg-pink-100 px-2.5 py-1 rounded-md border border-pink-200">
                  {evt.id}
                </span>
                <h3 className="font-bold text-slate-900 text-base">{evt.title}</h3>
              </div>
              <p className="text-xs text-slate-500">
                Location: {evt.location} • Time: {evt.time}
              </p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="font-semibold text-slate-500">Reason:</span> {evt.detail.incidentDescription}
              </p>
            </div>

            <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 min-w-[200px] text-xs space-y-2">
              <div>
                <span className="text-slate-400 block">Operator Name</span>
                <span className="font-semibold text-slate-800">
                  {evt.driver}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Vehicle Target</span>
                <span className="font-semibold text-slate-800">
                  {evt.vehicle}
                </span>
              </div>
              <Link href={evt.actionUrl || "/driver/safety"} className="bg-pink-50 hover:bg-pink-100 text-pink-700 font-semibold py-2 text-center rounded-xl transition-all border border-pink-200/80">
                Open safety record
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// System History Component
function SystemHistoryView() {
  const [historyItems, setHistoryItems] = useState<HistoryRow[]>([]);

  useEffect(() => {
    let active = true;

    getAlertHistory()
      .then((history) => {
        if (!active) return;

        const rows: HistoryRow[] = (Array.isArray(history) ? history : [])
          .map((entry: { id: string; created_at?: string; description?: string; action?: string; alerts?: CanonicalAlertRecord }) => ({
            id: entry.id,
            alertId: entry.alerts?.id,
            timestamp: entry.created_at ? new Date(entry.created_at).toLocaleString() : "Recent",
            subsystem: (entry.alerts?.category || "Notifications") as HistoryRow["subsystem"],
            description: entry.description || `${entry.action}: ${entry.alerts?.title || "Alert"}`,
            severity: String(entry.alerts?.severity || "MEDIUM").toLowerCase() as Severity,
            ttr: "N/A",
          }))
          .sort((a, b) => {
            const aTime = new Date(a.timestamp).getTime() || 0;
            const bTime = new Date(b.timestamp).getTime() || 0;
            return bTime - aTime;
          })
          .slice(0, 6);

        setHistoryItems(rows);
      })
      .catch((error) => {
        console.error("Failed to load system history:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <AlertHero
        badge="FTM System History"
        icon="history"
        title="Alert & Operational History"
        description="Review the append-only timeline of alert creation, acknowledgement, assignment, and resolution actions."
      />

      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-pink-50/50 border-b border-pink-100 text-slate-500 font-bold uppercase tracking-wider">
              <th className="p-4">Event ID</th>
              <th className="p-4">Timestamp</th>
              <th className="p-4">Subsystem</th>
              <th className="p-4">Description</th>
              <th className="p-4">TTR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {historyItems.length === 0 ? (
              <tr><td colSpan={5} className="p-12 text-center text-sm text-slate-500">No alert history available.</td></tr>
            ) : historyItems.map((row) => (
              <tr key={row.id} className="hover:bg-pink-50/20 transition-all">
                <td className="p-4 font-mono font-bold text-slate-700">{row.id}</td>
                <td className="p-4 text-slate-500">{row.timestamp}</td>
                <td className="p-4">
                  <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold">
                    {row.subsystem}
                  </span>
                </td>
                <td className="p-4 text-slate-800 max-w-md">
                  {row.alertId ? (
                    <Link href={`/alerts?tab=active&alert=${encodeURIComponent(row.alertId)}`} className="hover:text-pink-700 hover:underline">
                      {row.description}
                    </Link>
                  ) : row.description}
                </td>
                <td className="p-4 font-mono text-pink-600 font-bold">{row.ttr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Reuseable Reusable Modal Wrapper Component
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-pink-100 w-full max-w-md p-6 relative">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-pink-100">
          <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-xs font-bold"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
