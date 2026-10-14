"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import {
  ClipboardList,
  Plus,
  Pencil,
  Archive,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  Check,
  ChevronDown,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";
import SpncAssistant from "../../components/SpncAssistant";
import { can } from "../../lib/rbac";

const CATEGORY_OPTIONS = ["handling", "documentation", "customs", "safety", "storage", "transport", "general"];
// Status is no longer shown or edited on this page. New SOPs are saved as NEW_SOP_STATUS;
// edited SOPs keep the status they already have.
const NEW_SOP_STATUS = "published";
const PAGE_SIZE = 5;
const RECENT_SEARCHES_KEY = "sops_recent_searches";
const MAX_RECENT_SEARCHES = 5;
const TABLE_SCROLL_STEP = 320; // pixels moved per click on the table's left/right buttons
// Anomaly alert highlight (dashboard alert / assistant "Fix" link: ?highlight=<sop id>&field=<field>&highlightName=<code · title>)
// Which table column shows each field, so the right cell gets the stronger red.
const FIELD_TO_COLUMN: Record<string, string> = {
  title: "SOP",
  sop_code: "SOP",
  version: "SOP",
  scope: "SOP",
  content: "SOP",
  status: "SOP",
  department: "Department",
  category: "Category",
  owner: "Owner",
  effective_date: "Effective",
  review_date: "Review",
};
const HIGHLIGHT_ROW = "bg-[#E5484D]/10";
const HIGHLIGHT_CELL = "bg-[#E5484D]/20";
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
  department?: string | null; // which department the SOP belongs to
  created_at?: string | null;
  // Approval flow: filled in when an employee edits an SOP and an admin hasn't decided yet.
  pending_changes?: PendingChanges | null;
  pending_by_name?: string | null;
  pending_at?: string | null;
};

/* Rows with status 'pending' or 'declined' (requests from other departments) are kept out of the SOP table. */
const REQUEST_STATUSES = ["pending", "declined"];
const isRequest = (s: SOP) => REQUEST_STATUSES.includes(s.status);

// An employee's edit that is waiting for an admin: { field: { from, to } }
type PendingChanges = Record<string, { from: unknown; to: unknown }>;

// True when an employee edit is waiting for an admin on this SOP.
const hasPending = (s: SOP) => !!s.pending_changes && Object.keys(s.pending_changes).length > 0;

// Tolerates casing/whitespace differences ("Admin", " admin ") from the session.
const isAdminRole = (role: unknown) => typeof role === "string" && role.trim().toLowerCase() === "admin";

// Friendly names for the fields shown in the "Pending approvals" panel.
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  sop_code: "SOP code",
  category: "Category",
  scope: "Scope",
  department: "Department",
  version: "Version",
  effective_date: "Effective date",
  review_date: "Review date",
  content: "Procedure",
  owner: "Owner",
  status: "Status",
};

// How a value is shown in the "Pending approvals" panel (long procedure text is shortened)
function formatChangeValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  if (field === "content") return text.length > 80 ? `${text.slice(0, 80).replace(/\s+/g, " ")}…` : text;
  return text;
}

// Every column in public.sops except title/sop_code can be null; fill safe defaults once.
function normalizeSop(s: Partial<SOP> & { id: string }): SOP {
  return {
    id: s.id,
    title: s.title ?? "",
    sop_code: s.sop_code ?? "",
    category: s.category ?? "general",
    scope: s.scope ?? null,
    version: s.version ?? "1.0",
    effective_date: s.effective_date ?? null,
    review_date: s.review_date ?? null,
    content: s.content ?? null,
    owner: s.owner ?? null,
    status: s.status ?? "draft",
    department: s.department ?? null,
    created_at: s.created_at ?? null,
    pending_changes: s.pending_changes ?? null,
    pending_by_name: s.pending_by_name ?? null,
    pending_at: s.pending_at ?? null,
  };
}

/* ---------- Confirmation window (replaces the browser's confirm() popup) ---------- */
type ConfirmKind = "archive";
type ConfirmState = { kind: ConfirmKind; sop: SOP } | null;

const CONFIRM_COPY: Record<ConfirmKind, { title: string; action: string; busy: string; tone: "green" | "red" }> = {
  archive: { title: "Archive this SOP?", action: "Archive", busy: "Archiving…", tone: "red" },
};

function ConfirmDialog({
  state,
  isDark,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  isDark: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Esc closes (Enter works too: the confirm button has focus)
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, busy, onCancel]);

  if (!state) return null;
  const { kind, sop } = state;
  const copy = CONFIRM_COPY[kind];
  const green = copy.tone === "green";
  const muted = isDark ? "text-[#8FA0AF]" : "text-gray-500";
  const strong = isDark ? "text-[#F2F1EC]" : "text-gray-900";
  const Icon = AlertTriangle;

  const message = <>This SOP will be removed from the list. This can&apos;t be undone from this page.</>;

  const details: { label: string; value: string }[] = [
    { label: "Department", value: sop.department || "—" },
    { label: "Category", value: sop.category ? sop.category.charAt(0).toUpperCase() + sop.category.slice(1) : "—" },
    { label: "Owner", value: sop.owner || "—" },
    { label: "Review date", value: sop.review_date || "—" },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sop-confirm-title"
    >
      <div
        className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${
          isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
        }`}
        style={{ animation: "sopConfirmIn 160ms ease-out" }}
      >
        <style>{`@keyframes sopConfirmIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>

        {/* Coloured top bar */}
        <div className={`h-1.5 w-full ${green ? "bg-[#1FA968]" : "bg-[#E2685A]"}`} />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                green ? (isDark ? "bg-[#0F2E22] text-[#3BD68A]" : "bg-[#E1F7EC] text-[#1FA968]") : isDark ? "bg-[#2A1212] text-[#E2685A]" : "bg-[#FBE4E1] text-[#D9483A]"
              }`}
            >
              <Icon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="sop-confirm-title" className={`text-lg font-semibold ${strong}`} style={{ fontFamily: "var(--font-display)" }}>
                {copy.title}
              </h3>
              <p className={`mt-1 text-sm leading-relaxed ${muted}`}>{message}</p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              aria-label="Close"
              className={`-mr-2 -mt-2 rounded-md p-1.5 transition disabled:opacity-40 ${isDark ? "text-[#8FA0AF] hover:bg-[#1A2530]" : "text-gray-400 hover:bg-gray-100"}`}
            >
              <X size={18} />
            </button>
          </div>

          {/* SOP card */}
          <div className={`mt-5 rounded-xl border p-4 ${isDark ? "border-[#23303D] bg-[#0B1220]" : "border-gray-200 bg-gray-50"}`}>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  isDark ? "bg-[#1A2530] text-[#F2419B]" : "bg-[#FCE7F3] text-[#F2419B]"
                }`}
              >
                <ClipboardList size={16} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#F2419B]" title={sop.title}>
                  {sop.title || "Untitled SOP"}
                </div>
                <div className={`text-xs ${muted}`}>
                  {sop.sop_code || "No code"} · v{sop.version}
                </div>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {details.map((d) => (
                <div key={d.label} className={d.label === "Description" ? "col-span-2" : ""}>
                  <dt className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>{d.label}</dt>
                  <dd className={`mt-0.5 text-sm ${strong} ${d.label === "Description" ? "line-clamp-2" : "truncate"}`} title={d.value}>
                    {d.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">{error}</div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              autoFocus
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${
                green ? "bg-[#1FA968] hover:bg-[#23BF76]" : "bg-[#E2685A] hover:bg-[#D9483A]"
              }`}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
              {busy ? copy.busy : copy.action}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const emptyForm = {
  title: "",
  sop_code: "",
  category: "general",
  scope: "",
  department: "",
  version: "1.0",
  effective_date: "",
  review_date: "",
  content: "",
  owner: "",
  status: NEW_SOP_STATUS,
};

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

/* ---------- Freight operations SOPs ----------
 * The SOPs below cover the whole freight operation run by Service Provider and Network Control:
 * provider accreditation → rates → route planning → dispatch → transit → hand-over → delivery → returns.
 * SOP-01 to SOP-05 use the same codes the Service Network & Route Planning page attaches to each
 * delivery, so a code shown on a planned delivery opens the same procedure here.
 *
 * On the first visit each one is saved to Supabase through the same POST route as "New SOP"
 * (admins only on the server). Codes that were saved are remembered in this browser, so an
 * archived SOP isn't added back. If saving fails (e.g. an employee opened the page first),
 * they are still shown from this list; Edit and Archive then work on this page only, for admins.
 */
const SPNC_DEPT = "Service Provider and Network Control";
const SEED_ID_PREFIX = "seed-";
const SEEDED_SOPS_KEY = "sops_seeded_codes_v1";
const LIVE_REFRESH_MS = 30_000; // reload SOPs from Supabase every 30 seconds while the page is open
const isSeedSop = (id: string) => id.startsWith(SEED_ID_PREFIX);
const sameText = (a?: string | null, b?: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

// Which freight-operations module each built-in SOP is used in (shown under the SOP code).
const SOP_MODULES: Record<string, string[]> = {
  "SOP-01": ["Route Planning", "Deliveries"],
  "SOP-02": ["Route Planning", "Shipments"],
  "SOP-03": ["Route Planning", "Deliveries"],
  "SOP-04": ["Route Planning", "Deliveries"],
  "SOP-05": ["Deliveries"],
  "SOP-06": ["Service Providers"],
  "SOP-07": ["Rates & Tariffs"],
  "SOP-08": ["Route Planning", "Service Providers"],
  "SOP-09": ["Schedules & Timetable"],
  "SOP-10": ["Service Providers", "Deliveries"],
  "SOP-11": ["Deliveries", "Route Planning"],
  "SOP-12": ["Deliveries", "Service Providers"],
  "SOP-13": ["Shipments", "Deliveries"],
};

const SEED_EFFECTIVE = "2026-10-01";
const SEED_REVIEW = "2027-04-01"; // every SOP is reviewed after 6 months

const SEED_SOPS: Omit<SOP, "id">[] = [
  {
    sop_code: "SOP-01",
    title: "Pre-dispatch checklist",
    category: "transport",
    scope: "Every planned delivery, before the vehicle leaves the origin hub",
    content: [
      "1. Confirm the route, provider and departure slot assigned in Route Planning.",
      "2. Check the vehicle: OR/CR, tires, lights, brakes, fuel and that it matches the planned vehicle type.",
      "3. Check the driver: valid driver's license for the vehicle class and fit to drive.",
      "4. Check the load against the shipment: piece count, weight, seals and labels.",
      "5. Attach the SOPs that apply (port, cold-chain or heavy vehicle) to the trip.",
      "6. Mark the delivery as departed only after every item above is checked.",
    ].join("\n"),
    owner: "Network Control Dispatcher",
  },
  {
    sop_code: "SOP-02",
    title: "Port and customs documents",
    category: "customs",
    scope: "Routes that start or end at a port hub (Manila, Batangas, Subic)",
    content: [
      "1. Confirm the Bureau of Customs release of the shipment before booking the pick-up.",
      "2. Carry the bill of lading, commercial invoice, packing list and gate pass for the container.",
      "3. Book the port pick-up / return slot with the terminal and record it on the delivery.",
      "4. Check the container number and seal number at the gate against the documents.",
      "5. Return empty containers to the depot named by the shipping line within the free time.",
      "6. File copies of all port documents with the delivery record.",
    ].join("\n"),
    owner: "Customs & Documentation Officer",
  },
  {
    sop_code: "SOP-03",
    title: "Cold-chain handling",
    category: "handling",
    scope: "Reefer truck deliveries (chilled and frozen goods)",
    content: [
      "1. Pre-cool the reefer to the set temperature before loading.",
      "2. Chilled goods: keep at 0–4 °C. Frozen goods: keep at −18 °C or colder, unless the shipper states otherwise.",
      "3. Log the temperature at loading, at every stop and at delivery.",
      "4. Keep door openings short; never leave the reefer unit off while loaded.",
      "5. If the temperature goes out of range, report it at once under SOP-11.",
      "6. Hand the temperature log to the receiver with the proof of delivery.",
    ].join("\n"),
    owner: "Cold-Chain Coordinator",
  },
  {
    sop_code: "SOP-04",
    title: "Heavy vehicle routing and weigh-in",
    category: "safety",
    scope: "10-wheeler trucks and container trailers",
    content: [
      "1. Plan the route around truck-ban roads and hours in Metro Manila (check the current MMDA truck ban schedule).",
      "2. Keep the load within the legal axle load limit under the Anti-Overloading Act (RA 8794).",
      "3. Stop at weighbridges when required and keep the weigh ticket with the trip papers.",
      "4. Use only routes and bridges rated for the vehicle's weight and height.",
      "5. Secure the load (lashing, twist locks) before departure and after any re-stack.",
    ].join("\n"),
    owner: "Fleet Safety Officer",
  },
  {
    sop_code: "SOP-05",
    title: "Proof of delivery",
    category: "documentation",
    scope: "Every completed delivery",
    content: [
      "1. Check the receiver's name and ID against the delivery record.",
      "2. Count the pieces and check for damage together with the receiver.",
      "3. Get the receiver's signature, the date and time, and a photo of the delivered goods.",
      "4. Note any damage or shortage on the POD before signing off.",
      "5. Upload the POD to the delivery record the same day and mark the delivery as Delivered.",
    ].join("\n"),
    owner: "Delivery Operations Supervisor",
  },
  {
    sop_code: "SOP-06",
    title: "Service provider accreditation and review",
    category: "general",
    scope: "All carriers, forwarders, couriers and partners in Service Provider Management",
    content: [
      "1. Collect the provider's business registration, contact person, hotline and email, office address and service modes.",
      "2. Confirm the contact details from the provider's official channels before saving them.",
      "3. Record the contract reference and attach the signed agreement (PDF).",
      "4. Set the provider to Active only after the documents are complete.",
      "5. Review each provider every 6 months: on-time rate, damage claims and rating.",
      "6. Set the provider to Inactive if it stops operating or fails the review.",
    ].join("\n"),
    owner: "Service Provider Manager",
  },
  {
    sop_code: "SOP-07",
    title: "Rate and tariff update approval",
    category: "documentation",
    scope: "Every rate in Rates & Tariffs Management",
    content: [
      "1. Take rates only from the provider's published rate card or a signed quotation.",
      "2. Record the source of the rate in the rate's notes.",
      "3. Keep a rate as Draft until the amount is confirmed; only confirmed rates may be Active.",
      "4. Set Valid From / Valid To for every rate; a rate past Valid To is set to Expired.",
      "5. Notify Finance when a rate is added or changed.",
    ].join("\n"),
    owner: "Rates & Tariffs Analyst",
  },
  {
    sop_code: "SOP-08",
    title: "Route planning and provider assignment",
    category: "transport",
    scope: "Every shipment request received from Shipments",
    content: [
      "1. Review the request: origin, destination, cargo and vehicle type.",
      "2. Compare the route options by distance, transit time and cost.",
      "3. Assign an Active provider that serves both hubs and has the vehicle type.",
      "4. Pick a departure slot from the timetable that meets the requested delivery time.",
      "5. Attach the SOPs that apply and confirm the plan; the delivery moves to Upcoming.",
    ].join("\n"),
    owner: "Network Planner",
  },
  {
    sop_code: "SOP-09",
    title: "Schedule and transit timetable changes",
    category: "transport",
    scope: "Departure slots and lane transit times in Schedules & Timetable",
    content: [
      "1. Change a slot or transit time only with the reason recorded (traffic, provider capacity, port schedule).",
      "2. Check which Upcoming deliveries use the slot before changing it.",
      "3. Re-plan or notify the affected deliveries and providers.",
      "4. Publish the updated timetable and note the effective date.",
    ].join("\n"),
    owner: "Network Planner",
  },
  {
    sop_code: "SOP-10",
    title: "Courier drop-off and parcel hand-over",
    category: "handling",
    scope: "Parcels handed to courier partners (J&T Home, LBC, Flash Home, Shopee Xpress, Ninja Van, GoGo Xpress)",
    content: [
      "1. Pack each parcel within the courier's size and weight limits.",
      "2. Print and attach the courier's airway bill / waybill.",
      "3. Hand the parcels to the courier rider or drop-off point and get the receipt or scan confirmation.",
      "4. Record the courier tracking number on the delivery.",
      "5. Check tracking daily until delivered; follow SOP-12 for failed deliveries.",
    ].join("\n"),
    owner: "Last-Mile Coordinator",
  },
  {
    sop_code: "SOP-11",
    title: "Delay, incident and anomaly response",
    category: "safety",
    scope: "Delayed deliveries, accidents, cargo damage, temperature breaches and anomaly alerts",
    content: [
      "1. The driver or provider reports the incident to Network Control right away.",
      "2. Make sure people are safe first; call emergency services if needed.",
      "3. Record what happened, where and when, with photos.",
      "4. Inform the shipper of the delay or damage and the new ETA.",
      "5. Re-plan the delivery or send a replacement vehicle if needed.",
      "6. For anomaly alerts, open the flagged record, fix the field and dismiss the alert.",
      "7. File a damage or loss claim with the provider within the agreed period.",
    ].join("\n"),
    owner: "Network Control Lead",
  },
  {
    sop_code: "SOP-12",
    title: "Failed delivery and return to sender (RTS)",
    category: "general",
    scope: "Deliveries that could not be completed",
    content: [
      "1. Record the reason for the failed attempt (receiver absent, wrong address, refused).",
      "2. Contact the receiver to arrange a second attempt.",
      "3. After the provider's maximum attempts, mark the parcel for return to sender.",
      "4. Track the return until it reaches the origin hub and inform the shipper.",
      "5. Check any return fee against the provider's rate before approving payment.",
    ].join("\n"),
    owner: "Delivery Operations Supervisor",
  },
  {
    sop_code: "SOP-13",
    title: "Hub receiving and temporary storage",
    category: "storage",
    scope: "Cargo received at a hub before dispatch",
    content: [
      "1. Check the shipment documents against the cargo received (pieces, weight, seals).",
      "2. Report shortages or damage before signing for the cargo.",
      "3. Label and store the cargo by destination and departure slot.",
      "4. Keep cold-chain goods in temperature-controlled storage (SOP-03).",
      "5. Release cargo only to the vehicle assigned in Route Planning.",
    ].join("\n"),
    owner: "Hub Supervisor",
  },
].map((x) => ({
  ...x,
  version: "1.0",
  effective_date: SEED_EFFECTIVE,
  review_date: SEED_REVIEW,
  status: NEW_SOP_STATUS,
  department: SPNC_DEPT,
  created_at: null,
}));

function readSeededCodes(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEDED_SOPS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]).map((c) => c.toLowerCase()) : []);
  } catch {
    return new Set();
  }
}
function writeSeededCodes(codes: Set<string>) {
  try {
    window.localStorage.setItem(SEEDED_SOPS_KEY, JSON.stringify([...codes]));
  } catch {
    // ignore unavailable storage
  }
}
// A built-in SOP counts as already saved if the database has its code or its title.
const inRows = (rows: SOP[], seed: Omit<SOP, "id">) =>
  rows.some((r) => sameText(r.sop_code, seed.sop_code) || sameText(r.title, seed.title));

function formatSyncTime(d: Date | null) {
  return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—";
}

/* ---------- SOP details window ----------
 * Opens from the eye button or by clicking the SOP title. Shows the description (scope),
 * the full procedure as numbered steps, who owns it, its dates and where it is used.
 */
function formatSopDate(v?: string | null) {
  if (!v) return null;
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(v);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysFromToday(v?: string | null) {
  if (!v) return null;
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

// "1. Do this" / "2) Do that" / "- item" → separate steps; plain paragraphs stay as text.
function splitSteps(content?: string | null) {
  return (content ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d+)[.)]\s+(.*)$/) ?? line.match(/^[-•*]\s+()(.*)$/);
      return m ? { num: m[1] || null, text: m[2], isStep: true } : { num: null, text: line, isStep: false };
    });
}

function SopDetails({
  sop,
  isDark,
  onClose,
  onEdit,
}: {
  sop: SOP | null;
  isDark: boolean;
  onClose: () => void;
  onEdit: (s: SOP) => void;
}) {
  useEffect(() => {
    if (!sop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sop, onClose]);

  if (!sop) return null;
  const muted = isDark ? "text-[#8FA0AF]" : "text-gray-500";
  const strong = isDark ? "text-[#F2F1EC]" : "text-gray-900";
  const panel = isDark ? "border-[#23303D] bg-[#0B1220]" : "border-gray-200 bg-gray-50";
  const steps = splitSteps(sop.content);
  const modules = SOP_MODULES[sop.sop_code.toUpperCase()] ?? [];
  const reviewIn = daysFromToday(sop.review_date);
  const review =
    reviewIn === null
      ? null
      : reviewIn < 0
      ? { text: `Review overdue by ${-reviewIn} day${reviewIn === -1 ? "" : "s"}`, cls: "text-[#E2685A]" }
      : reviewIn <= 30
      ? { text: reviewIn === 0 ? "Review due today" : `Review due in ${reviewIn} day${reviewIn === 1 ? "" : "s"}`, cls: isDark ? "text-[#F2A23B]" : "text-[#C9791A]" }
      : { text: `Next review in ${reviewIn} days`, cls: muted };

  const facts: { label: string; value: string }[] = [
    { label: "SOP code", value: sop.sop_code || "—" },
    { label: "Version", value: sop.version ? `v${sop.version}` : "—" },
    { label: "Category", value: sop.category ? sop.category.charAt(0).toUpperCase() + sop.category.slice(1) : "—" },
    { label: "Owner", value: sop.owner || "—" },
    { label: "Department", value: sop.department || "—" },
    { label: "Status", value: sop.status ? sop.status.charAt(0).toUpperCase() + sop.status.slice(1) : "—" },
    { label: "Effective", value: formatSopDate(sop.effective_date) ?? "—" },
    { label: "Review", value: formatSopDate(sop.review_date) ?? "—" },
  ];

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sop-details-title"
    >
      <div
        className={`flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
          isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
        }`}
        style={{ animation: "sopDetailsIn 160ms ease-out" }}
      >
        <style>{`@keyframes sopDetailsIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>
        <div className="h-1.5 w-full bg-[#F2419B]" />

        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${isDark ? "bg-[#1A2530] text-[#F2419B]" : "bg-[#FCE7F3] text-[#F2419B]"}`}>
            <ClipboardList size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="sop-details-title" className={`text-lg font-semibold leading-snug ${strong}`} style={{ fontFamily: "var(--font-display)" }}>
              {sop.title || "Untitled SOP"}
            </h3>
            <p className={`mt-0.5 text-xs ${muted}`}>
              {sop.sop_code} · v{sop.version} · {sop.department || "No department"}
            </p>
            {modules.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {modules.map((m) => (
                  <span key={m} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${isDark ? "bg-[#1A2530] text-[#7DD3FC]" : "bg-[#E0F2FE] text-[#0369A1]"}`}>
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`-mr-2 -mt-2 rounded-md p-1.5 transition ${isDark ? "text-[#8FA0AF] hover:bg-[#1A2530]" : "text-gray-400 hover:bg-gray-100"}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          <section>
            <h4 className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wide ${muted}`}>Description</h4>
            <p className={`text-sm leading-relaxed ${strong}`}>{sop.scope || "No description yet. Edit the SOP to add one."}</p>
          </section>

          <section>
            <h4 className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
              Procedure{steps.some((x) => x.isStep) ? ` · ${steps.filter((x) => x.isStep).length} steps` : ""}
            </h4>
            {steps.length === 0 ? (
              <p className={`text-sm ${muted}`}>No procedure content yet.</p>
            ) : (
              <ol className={`space-y-2 rounded-xl border p-4 ${panel}`}>
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    {step.isStep ? (
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F2419B] text-[11px] font-bold text-white">
                        {step.num ?? "•"}
                      </span>
                    ) : null}
                    <span className={strong}>{step.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <h4 className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${muted}`}>Details</h4>
            <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-4 sm:grid-cols-4 ${panel}`}>
              {facts.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>{f.label}</dt>
                  <dd className={`mt-0.5 break-words text-sm ${strong}`}>{f.value}</dd>
                </div>
              ))}
            </dl>
            {review && <p className={`mt-2 text-xs font-medium ${review.cls}`}>{review.text}</p>}
          </section>
        </div>

        {/* Footer */}
        <div className={`flex gap-3 border-t px-6 py-4 ${isDark ? "border-[#23303D]" : "border-gray-200"}`}>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition ${
              isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(sop)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F2419B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#F55CAB]"
          >
            <Pencil size={15} />
            Edit SOP
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SOPsPage() {
  const { theme, role, roleLoading } = useShell();
  const isDark = theme === "dark";
  // Only admins can add SOPs and archive them. Employees' edits are sent to an admin for approval.
  const canAddSop = !roleLoading && isAdminRole(role);
  const canApprove = !roleLoading && can(role, "sops:approve");

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

  // Table left/right scrolling (arrow buttons above the table)
  const tableScrollRef = useRef<HTMLDivElement>(null);
  function scrollTable(direction: "left" | "right") {
    tableScrollRef.current?.scrollBy({
      left: direction === "left" ? -TABLE_SCROLL_STEP : TABLE_SCROLL_STEP,
      behavior: "smooth",
    });
  }

  // Built-in freight-operations SOPs
  const seedAttempted = useRef(false); // only try saving them to Supabase once per visit
  const archivedSeeds = useRef<Set<string>>(new Set()); // built-in SOPs archived on this page only

  // Live data: SOPs are reloaded from Supabase every LIVE_REFRESH_MS
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

  // Approval flow
  const [notice, setNotice] = useState<string | null>(null); // green message, e.g. "sent to an admin for approval"
  const [reviewingId, setReviewingId] = useState<string | null>(null); // SOP being approved/declined

  // Styled confirmation window for Archive
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // ---- Anomaly alert highlight ----
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [highlightColumn, setHighlightColumn] = useState<string | null>(null);
  const [highlightField, setHighlightField] = useState<string | null>(null);
  const [highlightMissing, setHighlightMissing] = useState<string | null>(null);
  const pendingHighlight = useRef<{ id: string | null; name: string | null; field: string | null } | null>(null);
  const handledSearch = useRef<string | null>(null);
  const [urlTick, setUrlTick] = useState(0);

  // Rows showing their full details ("See more")
  const [expandedSops, setExpandedSops] = useState<Set<string>>(() => new Set());

  // SOP shown in the details window (eye button / click on the title).
  // Kept by id so the window shows the latest data after a live refresh.
  const [viewingSopId, setViewingSopId] = useState<string | null>(null);
  const viewingSop = viewingSopId ? sops.find((x) => x.id === viewingSopId) ?? null : null;
  const setViewingSop = (x: SOP | null) => setViewingSopId(x ? x.id : null);

  function toggleExpanded(id: string) {
    setExpandedSops((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function readSops(): Promise<SOP[]> {
    const res = await fetch("/spnc/app/api/sops", { cache: "no-store" });
    if (!res.ok) throw new Error(`SOP request failed (${res.status})`);
    const data = await res.json();
    return Array.isArray(data.sops)
      ? data.sops.filter((x: Partial<SOP>) => typeof x.id === "string").map(normalizeSop)
      : [];
  }

  // First visit: save built-in SOPs that aren't in Supabase yet.
  // Only admins can create SOPs on the server, so for employees this fails quietly and the
  // built-in SOPs are shown from SEED_SOPS instead.
  async function seedMissingSops(rows: SOP[]): Promise<SOP[]> {
    if (seedAttempted.current) return rows;
    seedAttempted.current = true;
    const seeded = readSeededCodes();
    const missing = SEED_SOPS.filter((x) => !inRows(rows, x) && !seeded.has(x.sop_code.toLowerCase()));
    if (missing.length === 0) return rows;

    const results = await Promise.all(
      missing.map((x) =>
        fetch("/spnc/app/api/sops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: x.title,
            sop_code: x.sop_code,
            category: x.category,
            scope: x.scope ?? "",
            department: x.department,
            version: x.version,
            effective_date: x.effective_date,
            review_date: x.review_date,
            content: x.content ?? "",
            owner: x.owner ?? "",
            status: x.status,
          }),
        })
          .then((r) => r.ok)
          .catch(() => false)
      )
    );
    missing.forEach((x, i) => {
      if (results[i]) seeded.add(x.sop_code.toLowerCase());
    });
    writeSeededCodes(seeded);
    return results.some(Boolean) ? readSops() : rows;
  }

  // Built-in SOPs that aren't in Supabase are shown from SEED_SOPS, keeping edits made on this page.
  function withLocalSeeds(rows: SOP[], prev: SOP[]): SOP[] {
    const seeded = readSeededCodes();
    const local = SEED_SOPS.filter(
      (x) => !inRows(rows, x) && !seeded.has(x.sop_code.toLowerCase()) && !archivedSeeds.current.has(x.sop_code.toLowerCase())
    ).map((x) => {
      const id = SEED_ID_PREFIX + x.sop_code.toLowerCase();
      return prev.find((p) => p.id === id) ?? normalizeSop({ ...x, id });
    });
    return [...rows, ...local];
  }

  // silent = live refresh in the background (no loading spinner, the table stays where it is)
  async function fetchSops(silent = false) {
    if (silent) setLiveRefreshing(true);
    else setLoading(true);
    try {
      let rows = await readSops();
      rows = await seedMissingSops(rows);
      setSops((prev) => withLocalSeeds(rows, prev));
      setLastSynced(new Date());
      setLiveError(null);
    } catch (err) {
      console.error("Fetch SOPs failed:", err);
      setSops((prev) => (prev.length ? prev : withLocalSeeds([], prev)));
      setLiveError("Couldn't reach the server. Showing the last loaded SOPs.");
    } finally {
      if (silent) setLiveRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    fetchSops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Live refresh ----
  // Reload every LIVE_REFRESH_MS while the tab is visible, and right away when you come back to the tab.
  // Paused while the Edit form or a confirmation window is open so nothing changes under you.
  useEffect(() => {
    if (modalOpen || confirmState) return;
    const tick = () => {
      if (document.visibilityState === "visible") fetchSops(true);
    };
    const timer = window.setInterval(tick, LIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, confirmState]);

  // Auto-hide the green notice after a few seconds
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 10000);
    return () => clearTimeout(t);
  }, [notice]);

  // Admin: approve or decline an employee's pending edit.
  async function reviewSop(id: string, action: "approve" | "decline") {
    if (!canApprove || reviewingId) return;
    setReviewingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/spnc/app/api/sops/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not process the request.");
      setNotice(action === "approve" ? "Changes approved and applied." : "Changes declined. The SOP was left as it was.");
      await fetchSops(true);
    } catch (err) {
      console.error("Review failed:", err);
      setDeleteError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setReviewingId(null);
    }
  }

  // Archive opens the confirmation window; the action runs when it's confirmed.
  function closeConfirm() {
    if (confirmBusy) return;
    setConfirmState(null);
    setConfirmError(null);
  }
  async function runConfirmed() {
    if (!confirmState || confirmBusy) return;
    const { kind, sop } = confirmState;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      if (kind === "archive") {
        if (isSeedSop(sop.id)) {
          // Built-in SOP that isn't in Supabase: remove it from this page only.
          archivedSeeds.current.add(sop.sop_code.toLowerCase());
          setSops((prev) => prev.filter((x) => x.id !== sop.id));
        } else {
          setDeletingId(sop.id);
          const res = await fetch(`/spnc/app/api/sops/${sop.id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || "Could not archive SOP.");
          }
          fetchSops();
        }
      }
      setConfirmState(null);
    } catch (err) {
      console.error(`${kind} failed:`, err);
      setConfirmError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setConfirmBusy(false);
      setDeletingId(null);
    }
  }

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

  // Official SOPs = everything that isn't a pending/declined request.
  const officialSops = sops.filter((x) => !isRequest(x));

  // SOPs that have an employee edit waiting for an admin.
  const pendingList = officialSops.filter(hasPending);

  const filteredSops = officialSops.filter((sop) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const haystack = [
      sop.title,
      sop.sop_code,
      sop.category,
      sop.scope,
      sop.department,
      sop.owner,
      sop.content,
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

  // ---- Anomaly alert highlight: read ?highlight=…&field=…&highlightName=… ----
  // Read after the SOPs have loaded (not only on mount): coming from the dashboard,
  // Next.js may update the address bar a moment after this page appears.
  function readHighlightFromUrl() {
    const search = window.location.search;
    if (!search || handledSearch.current === search) return;
    const params = new URLSearchParams(search);
    const id = params.get("highlight");
    const name = params.get("highlightName");
    if (!id && !name) return;
    handledSearch.current = search;
    pendingHighlight.current = { id, name, field: params.get("field") };
  }

  // Once SOPs are loaded, find the target, go to its page and mark it.
  useEffect(() => {
    if (loading) return;
    readHighlightFromUrl();
    const target = pendingHighlight.current;
    if (!target) return;
    pendingHighlight.current = null;

    const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
    // The alert's name can be "SOP-HND-1001 · QUIAPO-NITANG", "SOP-HND-1001" or just the title
    const parts = norm(target.name).split(/\s*[·|]\s*/).filter(Boolean);
    const byId = (s: SOP) => !!target.id && s.id === target.id;
    const byName = (s: SOP) => {
      const code = norm(s.sop_code);
      const title = norm(s.title);
      return parts.some((p) => (!!code && p === code) || (!!title && p === title));
    };

    const official = sops.filter((s) => !isRequest(s));
    let idx = official.findIndex(byId);
    if (idx < 0) idx = official.findIndex(byName);
    if (idx >= 0) {
      const s = official[idx];
      setSearchInput("");
      setSearchTerm("");
      setPage(Math.floor(idx / PAGE_SIZE) + 1);
      setHighlightMissing(null);
      setHighlightId(s.id);
      setHighlightField(target.field);
      setHighlightColumn(FIELD_TO_COLUMN[target.field ?? ""] ?? "SOP");
      setExpandedSops((prev) => new Set(prev).add(s.id)); // show the full title/owner
      return;
    }
    console.warn("[SOPs] Anomaly alert: SOP not found", target);
    setHighlightMissing(target.name || target.id || "the SOP");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sops, urlTick]);

  // Also react when the address changes while you're already on this page (e.g. the assistant's "Fix" link)
  useEffect(() => {
    const onNav = () => {
      if (window.location.search && handledSearch.current !== window.location.search) setUrlTick((n) => n + 1);
    };
    window.addEventListener("popstate", onNav);
    const timer = window.setInterval(onNav, 800);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.clearInterval(timer);
    };
  }, []);

  // Scroll the highlighted row into view (re-runs when the table or page changes).
  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document.getElementById(`sop-row-${highlightId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, page, loading]);

  function clearHighlight() {
    setHighlightId(null);
    setHighlightColumn(null);
    setHighlightField(null);
    // drop ?highlight=… from the address bar so a refresh doesn't bring it back
    window.history.replaceState(null, "", window.location.pathname);
  }

  // Whole row light red, the problem column stronger red with a red border
  const hlCell = (id: string, column: string) =>
    highlightId === id ? (highlightColumn === column ? `${HIGHLIGHT_CELL} shadow-[inset_0_0_0_2px_#E5484D]` : HIGHLIGHT_ROW) : "";
  // Same highlight as inline styles (works even if the Tailwind classes above aren't generated)
  const hlStyle = (id: string, column: string): CSSProperties | undefined =>
    highlightId === id
      ? highlightColumn === column
        ? { background: "rgba(229, 72, 77, 0.2)", boxShadow: "inset 0 0 0 2px #E5484D" }
        : { background: "rgba(229, 72, 77, 0.1)" }
      : undefined;

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSaveError(null);
    setShowFieldErrors(false);
  }

  // Add SOP (admins only): opens the same form as Edit, empty.
  function openAddModal() {
    if (!canAddSop) return;
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(s: SOP) {
    setEditingId(s.id);
    setSaveError(null);
    setShowFieldErrors(false);
    setForm({
      title: s.title ?? "",
      sop_code: s.sop_code ?? "",
      category: CATEGORY_OPTIONS.includes(s.category) ? s.category : emptyForm.category,
      scope: s.scope || "",
      department: s.department || "",
      version: s.version || "1.0",
      effective_date: s.effective_date ? String(s.effective_date).slice(0, 10) : "",
      review_date: s.review_date ? String(s.review_date).slice(0, 10) : "",
      content: s.content || "",
      owner: s.owner || "",
      status: s.status || NEW_SOP_STATUS, // kept as-is, not editable
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
    if (!editingId && !canAddSop) {
      setSaveError("Only admins can add SOPs.");
      return;
    }

    const missing: string[] = [];
    if (!form.title.trim()) missing.push("Title");
    if (!form.sop_code.trim()) missing.push("SOP Code");
    if (!form.effective_date.trim()) missing.push("Effective Date");
    if (!form.review_date.trim()) missing.push("Review Date");
    if (!form.owner.trim()) missing.push("Owner");
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
      department: form.department.trim() || null,
      version: form.version,
      effective_date: form.effective_date || null,
      review_date: form.review_date || null,
      content: form.content,
      owner: form.owner,
      status: form.status,
    };

    // Built-in SOP that isn't in Supabase: update it on this page only (admins only,
    // because these edits never reach the server and so can't go through approval).
    if (editingId && isSeedSop(editingId)) {
      if (!canApprove) {
        setSaving(false);
        setSaveError("This SOP isn't saved to the database yet. Ask an admin to update it.");
        return;
      }
      setSops((prev) => prev.map((x) => (x.id === editingId ? normalizeSop({ ...x, ...payload, id: x.id }) : x)));
      if (editingId === highlightId) clearHighlight();
      setSaving(false);
      closeModal();
      return;
    }

    // Employees: if nothing changed, say so here instead of getting a 400 from the server.
    if (editingId && !canApprove) {
      const original = sops.find((x) => x.id === editingId);
      const text = (v: unknown) => String(v ?? "").trim();
      const day = (v: unknown) => text(v).slice(0, 10);
      const nothingChanged =
        !!original &&
        text(payload.title) === text(original.title) &&
        text(payload.sop_code) === text(original.sop_code) &&
        text(payload.category) === text(original.category) &&
        text(payload.scope) === text(original.scope) &&
        text(payload.department) === text(original.department) &&
        text(payload.version) === text(original.version) &&
        day(payload.effective_date) === day(original.effective_date) &&
        day(payload.review_date) === day(original.review_date) &&
        text(payload.content) === text(original.content) &&
        text(payload.owner) === text(original.owner) &&
        text(payload.status) === text(original.status);
      if (nothingChanged) {
        setSaving(false);
        setSaveError("You haven't changed anything yet. Edit a field, then submit for approval.");
        return;
      }
    }

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

      // Employee edit: the server saved it as a pending request instead of changing the SOP.
      if (res.status === 202) {
        setNotice("Your changes were sent to an admin for approval. The SOP will update once approved.");
        closeModal();
        fetchSops();
        return;
      }

      // The flagged SOP was just fixed, so remove its red highlight.
      if (editingId && editingId === highlightId) clearHighlight();
      closeModal();
      fetchSops();
    } catch (err) {
      console.error("Save SOP failed:", err);
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleArchive(id: string) {
    if (!canApprove) return; // admins only (the server enforces this too)
    const sop = sops.find((s) => s.id === id);
    if (!sop) return;
    setDeleteError(null);
    setConfirmError(null);
    setConfirmState({ kind: "archive", sop });
  }

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<ClipboardList size={20} />}
        title="Standard Operating Procedure Management"
        subtitle="Document and manage freight operating procedures"
      />

      <div className="px-8">
        {/* Add SOP: admins only */}
        {canAddSop && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-2 rounded-md bg-[#F2419B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#F55CAB]"
            >
              <Plus size={16} />
              Add SOP
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500"
          >
            <Check size={16} className="shrink-0" />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="ml-auto rounded p-0.5 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Live status */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className={`flex flex-wrap items-center gap-3 text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                {!liveError && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1FA968] opacity-60" />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${liveError ? "bg-[#E2685A]" : "bg-[#1FA968]"}`} />
              </span>
              <span className={liveError ? "text-[#E2685A]" : "text-[#1FA968]"}>{liveError ? "Offline" : "Live"}</span>
            </span>
            <span>
              {officialSops.length} SOP{officialSops.length === 1 ? "" : "s"} · updated {formatSyncTime(lastSynced)} · refreshes every{" "}
              {LIVE_REFRESH_MS / 1000}s
            </span>
            {liveError && <span className="text-[#E2685A]">{liveError}</span>}
            <button
              type="button"
              onClick={() => fetchSops(true)}
              disabled={liveRefreshing || loading}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-semibold transition disabled:opacity-50 ${
                isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <RefreshCw size={12} className={liveRefreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {highlightMissing && !highlightId && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-[#F2A23B]/50 bg-[#F2A23B]/10 px-3 py-2 text-sm text-[#C9791A]">
            <span className="font-semibold">Anomaly alert:</span>
            <span>Couldn&apos;t find &quot;{highlightMissing}&quot; in the SOP list. It may have been archived or renamed.</span>
            <button type="button" onClick={() => setHighlightMissing(null)} className="ml-auto rounded px-2 py-0.5 text-xs font-semibold hover:bg-[#F2A23B]/15">
              Dismiss
            </button>
          </div>
        )}

        {highlightId && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-[#E5484D]/40 bg-[#E5484D]/10 px-3 py-2 text-sm text-[#E5484D]">
            <span className="font-semibold">Anomaly alert:</span>
            <span>
              {(() => {
                const s = sops.find((x) => x.id === highlightId);
                return s ? [s.sop_code, s.title].filter(Boolean).join(" · ") : "This SOP";
              })()}
              {highlightField ? ` · check ${highlightField.replace(/_/g, " ")}` : ""}
              {" "}(outlined in red). Edit the SOP to fix it.
            </span>
            <button type="button" onClick={clearHighlight} className="ml-auto rounded px-2 py-0.5 text-xs font-semibold hover:bg-[#E5484D]/15">
              Dismiss
            </button>
          </div>
        )}

        {deleteError && (
          <div className="mb-4 border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
            {deleteError}
          </div>
        )}

        {/* Pending approvals: admins only */}
        {canApprove && pendingList.length > 0 && (
          <div className={`mb-6 rounded-lg border p-4 ${isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"}`}>
            <h2
              className={`mb-3 flex items-center gap-2 text-base font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              <Clock size={16} className="text-amber-500" />
              Pending approvals
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500">{pendingList.length}</span>
            </h2>
            <ul className="space-y-3">
              {pendingList.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-md border p-3 text-sm ${isDark ? "border-[#2C4356] text-[#C7D1DA]" : "border-gray-200 text-gray-700"}`}
                >
                  <div className="font-semibold text-[#F2419B]">{[s.sop_code, s.title].filter(Boolean).join(" · ")}</div>
                  <div className={`mb-2 text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Requested by {s.pending_by_name || "an employee"}
                    {s.pending_at ? ` · ${new Date(s.pending_at).toLocaleString()}` : ""}
                  </div>
                  <ul className="mb-3 space-y-1 text-xs">
                    {Object.entries(s.pending_changes ?? {}).map(([field, c]) => (
                      <li key={field}>
                        <span className="font-semibold">{FIELD_LABELS[field] ?? field}:</span>{" "}
                        <span className="line-through opacity-60">{formatChangeValue(field, c.from)}</span>
                        {" → "}
                        <span className="font-medium">{formatChangeValue(field, c.to)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={reviewingId !== null}
                      onClick={() => reviewSop(s.id, "approve")}
                      className="flex items-center gap-1.5 rounded-md bg-[#1FA968] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#23BF76] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reviewingId === s.id && <Loader2 size={12} className="animate-spin" />}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={reviewingId !== null}
                      onClick={() => reviewSop(s.id, "decline")}
                      className="rounded-md bg-[#E2685A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#D9483A] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : officialSops.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
            No SOPs found.
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
                    placeholder="Search SOP title, code, department, owner..."
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
                  
                  {/* Visible thin scrollbar: drag it, use the buttons above, shift + mouse wheel, or swipe on touch screens */}
                  <div
                    ref={tableScrollRef}
                    className={`overflow-x-auto [scrollbar-width:thin] ${
                      isDark ? "[scrollbar-color:#2C4356_transparent]" : "[scrollbar-color:#D1D5DB_transparent]"
                    }`}
                  >
                    <table className="min-w-[64rem] divide-y divide-[#23303D] text-left">
                      <thead className={isDark ? "bg-[#0B1220] text-[#8FA0AF]" : "bg-gray-50 text-gray-500"}>
                        <tr>
                          {['SOP', 'Department', 'Category', 'Owner', 'Effective', 'Review', 'Actions'].map((header) => (
                            <th key={header} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={isDark ? "divide-y divide-[#23303D] text-[#C7D1DA]" : "divide-y divide-gray-200 text-gray-700"}>
                        {pagedSops.map((s) => {
                          return (
                            <tr
                              key={s.id}
                              id={`sop-row-${s.id}`}
                              style={highlightId === s.id ? { outline: "2px solid #E5484D", outlineOffset: -2 } : undefined}
                              className={
                                highlightId === s.id
                                  ? "outline outline-2 -outline-offset-2 outline-[#E5484D]"
                                  : isDark
                                  ? "bg-[#121B26] hover:bg-[#182230]"
                                  : "bg-white hover:bg-gray-50"
                              }
                            >
                              <td className={`px-4 py-4 align-top ${hlCell(s.id, "SOP")}`} style={hlStyle(s.id, "SOP")}>
                                {(() => {
                                  const isExpanded = expandedSops.has(s.id);
                                  const hasMore =
                                    s.title.length > SOP_PREVIEW_CHARS || (s.owner || "").length > OWNER_PREVIEW_CHARS;
                                  return (
                                    <div className="max-w-[15rem]">
                                      <button
                                        type="button"
                                        onClick={() => setViewingSop(s)}
                                        className={`block max-w-full text-left font-semibold text-[#F2419B] hover:underline ${isExpanded ? "" : "truncate whitespace-nowrap"}`}
                                        title={`${s.title} (click to view details)`}
                                      >
                                        {s.title}
                                      </button>
                                      <div className={`mt-0.5 whitespace-nowrap text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                                        {s.sop_code} · v{s.version}
                                      </div>
                                      {hasPending(s) && (
                                        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-500">
                                          <Clock size={10} />
                                          Pending approval
                                        </div>
                                      )}
                                      {s.scope && (
                                        <div
                                          className={`mt-0.5 text-xs ${isExpanded ? "" : "line-clamp-2"} ${isDark ? "text-[#C7D1DA]" : "text-gray-600"}`}
                                          title={s.scope}
                                        >
                                          {s.scope}
                                        </div>
                                      )}
                                      {SOP_MODULES[s.sop_code.toUpperCase()] && (
                                        <div className="mt-1 flex flex-wrap gap-1" title="Freight operations module that uses this SOP">
                                          {SOP_MODULES[s.sop_code.toUpperCase()].map((m) => (
                                            <span
                                              key={m}
                                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                                isDark ? "bg-[#1A2530] text-[#7DD3FC]" : "bg-[#E0F2FE] text-[#0369A1]"
                                              }`}
                                            >
                                              {m}
                                            </span>
                                          ))}
                                        </div>
                                      )}
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
                              <td className={`whitespace-nowrap px-4 py-4 align-top ${hlCell(s.id, "Department")}`} style={hlStyle(s.id, "Department")}>{s.department || "—"}</td>
                              <td className={`whitespace-nowrap px-4 py-4 align-top ${hlCell(s.id, "Category")}`} style={hlStyle(s.id, "Category")}>
                                <span className={`rounded-full border px-3 py-1 text-xs capitalize tracking-wide ${isDark ? "border-[#2C4356] text-[#C7D1DA]" : "border-gray-300 text-gray-600"}`}>
                                  {s.category}
                                </span>
                              </td>
                              <td className={`px-4 py-4 align-top ${hlCell(s.id, "Owner")}`} style={hlStyle(s.id, "Owner")}>
                                <div
                                  className={`max-w-[11rem] ${expandedSops.has(s.id) ? "" : "truncate whitespace-nowrap"}`}
                                  title={s.owner || undefined}
                                >
                                  {s.owner || "—"}
                                </div>
                              </td>
                              <td className={`whitespace-nowrap px-4 py-4 align-top ${hlCell(s.id, "Effective")}`} style={hlStyle(s.id, "Effective")}>{s.effective_date || "—"}</td>
                              <td className={`whitespace-nowrap px-4 py-4 align-top ${hlCell(s.id, "Review")}`} style={hlStyle(s.id, "Review")}>{s.review_date || "—"}</td>
                              <td className={`px-4 py-4 align-top ${hlCell(s.id, "Actions")}`} style={hlStyle(s.id, "Actions")}>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setViewingSop(s)}
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
                                    disabled={!canApprove && (isSeedSop(s.id) || hasPending(s))}
                                    aria-label={`Edit ${s.title}`}
                                    title={
                                      !canApprove && isSeedSop(s.id)
                                        ? "Not saved to the database yet. Ask an admin to update it."
                                        : !canApprove && hasPending(s)
                                        ? "An edit is already waiting for admin approval"
                                        : canApprove
                                        ? "Edit SOP"
                                        : "Edit SOP (needs admin approval)"
                                    }
                                    className={`flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                      isDark
                                        ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]"
                                        : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                                    }`}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  {/* Archive: admins only */}
                                  {canApprove && (
                                    <button
                                      type="button"
                                      onClick={() => handleArchive(s.id)}
                                      disabled={deletingId === s.id}
                                      aria-label={`Archive ${s.title}`}
                                      title="Archive SOP"
                                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#E2685A] transition hover:bg-[#2A1212] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <Archive size={15} />
                                    </button>
                                  )}
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

            {/* Employees: tell them their edit will need an admin's approval */}
            {editingId && !canApprove && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                <Clock size={14} className="mt-0.5 shrink-0" />
                <span>Your changes won&apos;t be applied right away. They will be sent to an admin for approval.</span>
              </div>
            )}

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

              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Department
                </p>
                <input
                  type="text"
                  placeholder="e.g. Operations, Warehouse"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
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
                  Owner *
                </p>
                <input
                  type="text"
                  placeholder="e.g. Juan Dela Cruz"
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
                {saving
                  ? editingId
                    ? canApprove
                      ? "Updating…"
                      : "Submitting…"
                    : "Saving…"
                  : editingId
                  ? canApprove
                    ? "Update"
                    : "Submit for approval"
                  : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOP details window */}
      <SopDetails
        sop={viewingSop}
        isDark={isDark}
        onClose={() => setViewingSop(null)}
        onEdit={(x) => {
          setViewingSop(null);
          openEditModal(x);
        }}
      />

      {/* Archive confirmation */}
      <ConfirmDialog
        state={confirmState}
        isDark={isDark}
        busy={confirmBusy}
        error={confirmError}
        onCancel={closeConfirm}
        onConfirm={() => void runConfirmed()}
      />

      {/* Airship Express AI assistant (floating robot button) */}
      <SpncAssistant isDark={isDark} />
    </div>
  );
}
