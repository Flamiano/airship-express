"use client";

import React, { useEffect, useMemo, useState } from "react";
import GlobalNavbar from "../components/GlobalNavbar";
import { getIncidentReports, getNotifications, getTrackingEvents } from "../lib/api";

// Types & Data Definitions
type AlertTab = "active" | "maintenance" | "safety" | "history";
type Severity = "critical" | "high" | "medium" | "low";

interface ActiveAlert {
  id: string;
  severity: Severity;
  label: string;
  subsystem: string;
  time: string;
  vessel: string;
  message: string;
  actions: Array<"acknowledge" | "details" | "ticket">;
}

interface MaintenanceCard {
  status: "overdue" | "upcoming" | "routine";
  statusLabel: string;
  due: string;
  title: string;
  description: string;
  vessel: string;
  wide?: boolean;
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

interface IncidentReport {
  id: string;
  tripId?: string | null;
  vehicleId?: string | null;
  driverId?: string | null;
  incidentType: string;
  description: string;
  photoUrl?: string | null;
  reportedAt?: string | null;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  notificationType?: string | null;
  isRead: boolean;
  createdAt?: string | null;
}

const incidentSeverityMap: Record<string, Severity> = {
  Accident: "critical",
  Breakdown: "high",
  Theft: "critical",
  Delay: "medium",
  Other: "low",
};

const defaultIncidentSeverity: Severity = "medium";

function mapIncidentToAlert(incident: IncidentReport): ActiveAlert {
  const severity = incidentSeverityMap[incident.incidentType] ?? defaultIncidentSeverity;
  const label = severity === "critical" ? "Critical" : severity === "high" ? "High" : severity === "medium" ? "Medium" : "Low";
  return {
    id: incident.id,
    severity,
    label,
    subsystem: `${incident.incidentType} Incident`,
    time: incident.reportedAt ? new Date(incident.reportedAt).toLocaleString() : "Recent",
    vessel: incident.vehicleId ? `Vehicle ${incident.vehicleId}` : incident.tripId ? `Trip ${incident.tripId}` : "Operational Unit",
    message: incident.description || "Incident details are unavailable.",
    actions: severity === "critical" ? ["acknowledge", "details", "ticket"] : ["acknowledge", "details"],
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

const toneIconBg: Record<string, string> = {
  critical: "bg-rose-100 text-rose-600",
  high: "bg-pink-100 text-pink-600",
  info: "bg-pink-50 text-pink-500",
  success: "bg-emerald-100 text-emerald-600",
};

// Root Component
export default function AlertsPage() {
  const [tab, setTab] = useState<AlertTab>("active");

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (
      requestedTab === "maintenance" ||
      requestedTab === "safety" ||
      requestedTab === "history"
    ) {
      setTab(requestedTab);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-800 font-sans selection:bg-pink-500 selection:text-white">
      <GlobalNavbar />

      {/* Main Content Area - Maximized Width */}
      <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 sm:px-8 py-8">
        {tab === "active" && <ActiveAlerts />}
        {tab === "maintenance" && <MaintenanceNotifications />}
        {tab === "safety" && <SafetyEventsView />}
        {tab === "history" && <SystemHistoryView />}
      </main>

      {/* Footer */}
      <Footer />
    </div>
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
  const [selectedRange, setSelectedRange] = useState("Last 24 Hours");
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Notices
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<ActiveAlert | null>(null);
  const [ticketTarget, setTicketTarget] = useState<ActiveAlert | null>(null);
  const [confirmAcknowledge, setConfirmAcknowledge] = useState<ActiveAlert | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getIncidentReports(), getNotifications()])
      .then(([incidents, items]) => {
        if (!active) return;
        const mappedAlerts = incidents.map(mapIncidentToAlert);
        setAlerts(mappedAlerts);
        setNotifications(items);
        setLastUpdated(new Date().toLocaleString());
      })
      .catch((error) => {
        console.error("Failed to load alerts data:", error);
        if (active) {
          setAlerts([]);
          setNotifications([]);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const alertSummaryMetrics = useMemo(() => {
    const criticalCount = alerts.filter((alert) => alert.severity === "critical").length;
    const trackingCount = notifications.filter((notification) => {
      const type = String(notification.notificationType ?? "").toLowerCase();
      const text = `${notification.title ?? ""} ${notification.message ?? ""}`.toLowerCase();
      return type.includes("track") || text.includes("track");
    }).length;

    return [
      {
        icon: "warning",
        label: "Delivery Exceptions",
        sub: "Immediate action required",
        value: String(alerts.length),
        tone: "critical" as const,
      },
      {
        icon: "error",
        label: "Tracking Alerts",
        sub: "Review recommended",
        value: trackingCount > 0 ? String(trackingCount) : String(notifications.length),
        tone: "high" as const,
      },
      {
        icon: "build",
        label: "Bulk Handling Readiness",
        sub: "Scheduled within 48h",
        value: "5",
        tone: "info" as const,
      },
      {
        icon: "check_circle",
        label: "Nationwide Coverage",
        sub: "Service availability health",
        value: "98%",
        tone: "success" as const,
      },
    ];
  }, [alerts, notifications]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const priorityMatch =
        priority === "All Priorities" || alert.label === priority;
      const subsystemMatch =
        subsystem === "All Subsystems" || alert.subsystem === subsystem;
      return priorityMatch && subsystemMatch;
    });
  }, [priority, subsystem, alerts]);

  const confirmAcknowledgeNow = (alert: ActiveAlert) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    setConfirmAcknowledge(null);
    showNotice(`Alert ${alert.id} acknowledged and archived.`);
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

      {/* Header Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-pink-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Airship Express Operations Center
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            A Philippines-based courier service offering nationwide delivery, bulk parcel handling, real-time tracking, and dispatch dashboard visibility.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-pink-50 px-4 py-2 rounded-xl border border-pink-100 text-pink-700 text-xs font-semibold flex-wrap">
          <span>Total Active Issues:</span>
          <span className="bg-pink-600 text-white px-2 py-0.5 rounded-md text-xs font-bold">
            {alerts.length}
          </span>
          {lastUpdated && (
            <span className="text-slate-500 font-medium">Updated {lastUpdated}</span>
          )}
          {isLoading && (
            <span className="text-slate-500 font-medium">Loading live alerts…</span>
          )}
        </div>
      </div>

      {/* Metric Cards Grid - Full Width Spanning */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {alertSummaryMetrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-white p-5 rounded-2xl border border-pink-100/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {metric.label}
              </span>
              <span
                className={`p-2 rounded-xl text-lg font-bold ${toneIconBg[metric.tone]}`}
              >
                {metric.value}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-500 font-medium">{metric.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Filters:
          </span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-pink-500"
          >
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            value={subsystem}
            onChange={(e) => setSubsystem(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-pink-500"
          >
            {SUBSYSTEMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() =>
            setSelectedRange((c) =>
              c === "Last 24 Hours" ? "Last 7 Days" : "Last 24 Hours"
            )
          }
          className="bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200/80 rounded-xl px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-2"
        >
          <span>📅 Range: {selectedRange}</span>
        </button>
      </div>

      {/* Wide Content Grid - Feed + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Feed Column (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden flex flex-col">
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
                    {alert.message}
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

        {/* Map & Live Monitoring Sidebar (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-pink-100 shadow-sm p-5 flex flex-col justify-between min-h-[450px]">
          <div>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-pink-100">
              <h2 className="font-bold text-slate-900 text-sm">
                Priority Delivery Corridor
              </h2>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Radar
              </span>
            </div>

            {/* Mock Vector Map Visual Area */}
            <div className="w-full h-64 bg-slate-900 rounded-xl relative overflow-hidden flex items-center justify-center border border-slate-800">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ec4899_1px,transparent_1px)] [background-size:16px_16px]" />
              <div className="text-center z-10">
                <div className="w-12 h-12 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-400 flex items-center justify-center mx-auto mb-2 text-xl font-bold animate-pulse">
                  📍
                </div>
                <p className="text-xs font-mono text-pink-200">
                  North Luzon Corridor Tracking
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Lat: 40.7128 | Lng: -74.0060
                </p>
              </div>

              {/* Ping Markers */}
              <div className="absolute top-1/4 left-1/3 w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <div className="absolute bottom-1/3 right-1/4 w-3 h-3 rounded-full bg-pink-400" />
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-pink-50/60 border border-pink-100 text-xs space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Primary Delivery Corridor:</span>
              <span className="font-bold text-slate-800">North Luzon Transit</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Active Dispatch Units in Zone:</span>
              <span className="font-bold text-slate-800">14 Units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {confirmAcknowledge && (
        <Modal title="Confirm Acknowledgment" onClose={() => setConfirmAcknowledge(null)}>
          <p className="text-sm text-slate-600 mb-6">
            Are you sure you want to acknowledge alert{" "}
            <strong className="text-slate-900">{confirmAcknowledge.id}</strong>?
            This will mark it as resolved and clear it from active monitoring.
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
                Message Body
              </span>
              <p className="text-sm font-medium text-slate-800">{detailsTarget.message}</p>
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
          </div>
          <div className="flex justify-end mt-6">
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

    getNotifications()
      .then((items) => {
        if (!active) return;

        const maintenanceNotes = items
          .filter((item) => {
            const type = String(item.notificationType ?? "").toLowerCase();
            const text = `${item.title ?? ""} ${item.message ?? ""}`.toLowerCase();
            return type.includes("maint") || text.includes("maintenance") || text.includes("service");
          })
          .slice(0, 4)
          .map((item) => {
            const statusType: MaintenanceCard["status"] = String(item.notificationType ?? "").toLowerCase().includes("overdue")
              ? "overdue"
              : String(item.notificationType ?? "").toLowerCase().includes("routine")
              ? "routine"
              : "upcoming";

            return {
              status: statusType,
              statusLabel: item.notificationType ?? "Maintenance",
              due: item.createdAt
                ? `Created ${new Date(item.createdAt).toLocaleDateString()}`
                : "Scheduled soon",
              title: item.title ?? "Maintenance update",
              description: item.message ?? "Review maintenance alert details.",
              vessel: item.notificationType ?? "Maintenance",
            };
          });

        if (maintenanceNotes.length > 0) {
          setMaintenanceItems(maintenanceNotes);
        }
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
      <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Maintenance & Service Readiness
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Support for hubs, scanners, dispatch devices, and fleet readiness across nationwide delivery operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {maintenanceItems.map((card, idx) => (
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
                {card.description}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">{card.due}</span>
              <button className="text-pink-600 font-semibold hover:underline">
                View Checklist →
              </button>
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

    getIncidentReports()
      .then((incidents) => {
        if (!active) return;

        const liveEvents = incidents.slice(0, 4).map((incident) => ({
          id: incident.id,
          icon:
            incident.incidentType === "Accident"
              ? "car_crash"
              : incident.incidentType === "Breakdown"
              ? "speed"
              : "route",
          title: incident.incidentType || "Safety Incident",
          time: incident.reportedAt
            ? new Date(incident.reportedAt).toLocaleString()
            : "Recent",
          severity: incidentSeverityMap[incident.incidentType] ?? defaultIncidentSeverity,
          vehicle: incident.vehicleId ? `Vehicle ${incident.vehicleId}` : "Unknown Unit",
          driver: incident.driverId ? `Driver ${incident.driverId}` : "Dispatch Team",
          location: "Philippines",
          detail: {
            incidentType: incident.incidentType,
            incidentDescription: incident.description,
            speedBefore: "N/A",
            speedAfter: "N/A",
            driverName: incident.driverId ? `Driver ${incident.driverId}` : "Unknown",
            driverId: incident.driverId ?? "Unknown",
            absActivation: "Unknown",
            weather: "Unknown",
            loadStatus: "Unknown",
            coordinates: "N/A",
          },
        }));

        if (liveEvents.length > 0) {
          setSafetyEventItems(liveEvents);
        }
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
      <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Delivery Safety & Incident Logs</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Parcel handling exceptions, route compliance events, and driver safety reports for Airship Express operations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {safetyEventItems.map((evt) => (
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
                {evt.detail.incidentDescription}
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
              <button className="bg-pink-50 hover:bg-pink-100 text-pink-700 font-semibold py-2 rounded-xl transition-all border border-pink-200/80">
                Download Telemetry Log
              </button>
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

    Promise.all([getIncidentReports(), getNotifications(), getTrackingEvents()])
      .then(([incidents, notifications, trackingEvents]) => {
        if (!active) return;

        const incidentRows: HistoryRow[] = incidents.map((incident) => ({
          id: incident.id,
          timestamp: incident.reportedAt
            ? new Date(incident.reportedAt).toLocaleDateString()
            : "Recent",
          subsystem: "Safety",
          description: incident.description,
          severity: incidentSeverityMap[incident.incidentType] ?? defaultIncidentSeverity,
          ttr: "N/A",
        }));

        const notificationRows: HistoryRow[] = notifications.map((notification) => {
          const subsystemLabel = String(notification.notificationType ?? "").toLowerCase();
          const subsystemValue: HistoryRow["subsystem"] = subsystemLabel.includes("track")
            ? "Tracking"
            : subsystemLabel.includes("dispatch")
            ? "Dispatch"
            : subsystemLabel.includes("fuel")
            ? "Fuel"
            : subsystemLabel.includes("bulk")
            ? "Bulk Handling"
            : subsystemLabel.includes("fleet")
            ? "Fleet"
            : subsystemLabel.includes("safety")
            ? "Safety"
            : "Notifications";

          return {
            id: notification.id,
            timestamp: notification.createdAt
              ? new Date(notification.createdAt).toLocaleDateString()
              : "Recent",
            subsystem: subsystemValue,
            description: `${notification.title ?? "Notification"}: ${notification.message ?? "No details."}`,
            severity: "medium" as Severity,
            ttr: "N/A",
          };
        });

        const trackingRows: HistoryRow[] = trackingEvents.slice(0, 4).map((event) => ({
          id: event.id,
          timestamp: event.recordedAt
            ? new Date(event.recordedAt).toLocaleDateString()
            : "Recent",
          subsystem: "Tracking",
          description: `Vehicle ${event.entityId ?? event.tripId ?? "unknown"} reported at ${event.latitude}, ${event.longitude}. Speed ${event.speed} km/h.`,
          severity: "low" as Severity,
          ttr: "N/A",
        }));

        const rows: HistoryRow[] = [...incidentRows, ...notificationRows, ...trackingRows]
          .sort((a, b) => {
            const aTime = new Date(a.timestamp).getTime() || 0;
            const bTime = new Date(b.timestamp).getTime() || 0;
            return bTime - aTime;
          })
          .slice(0, 6);

        if (rows.length > 0) {
          setHistoryItems(rows);
        }
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
      <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Operational History</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Archived dispatch incidents, tracking events, and service resolution metrics.
        </p>
      </div>

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
            {historyItems.map((row) => (
              <tr key={row.id} className="hover:bg-pink-50/20 transition-all">
                <td className="p-4 font-mono font-bold text-slate-700">{row.id}</td>
                <td className="p-4 text-slate-500">{row.timestamp}</td>
                <td className="p-4">
                  <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold">
                    {row.subsystem}
                  </span>
                </td>
                <td className="p-4 text-slate-800 max-w-md">{row.description}</td>
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

// Global Footer Component
function Footer() {
  return (
    <footer className="mt-12 bg-white border-t border-pink-100 py-6 text-xs text-slate-500">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">Airship Express</span>
          <span>© 2026 Philippines-based courier service</span>
        </div>
        <div className="flex gap-6 font-medium text-slate-600">
          <a href="#" className="hover:text-pink-600 transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-pink-600 transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-pink-600 transition-colors">
            API Operational Status
          </a>
        </div>
      </div>
    </footer>
  );
}