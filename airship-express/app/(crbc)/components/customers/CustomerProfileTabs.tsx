"use client"

import { useState } from "react"
import { Package, MessageSquare, ClipboardList, Truck } from "lucide-react"
import { formatDate } from "@/app/(crbc)/library/utils/formattedate"
import {
  CHANNEL_LABELS,
  REQUEST_STATUS_LABELS,
} from "@/app/(crbc)/types/booking-request"

const shipmentStatusStyle: Record<string, string> = {
  Completed: "bg-emerald-50 text-emerald-600",
  "In Transit": "bg-blue-50 text-blue-600",
  Pending: "bg-amber-50 text-amber-600",
  Cancelled: "bg-red-50 text-red-600",
}

const requestStatusStyle: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600",
  SUBMITTED: "bg-blue-50 text-blue-600",
  PENDING: "bg-amber-50 text-amber-600",
  ACCEPTED: "bg-emerald-50 text-emerald-600",
  REJECTED: "bg-red-50 text-red-600",
  CANCELLED: "bg-red-50 text-red-600",
}

type Tab = "shipments" | "requests" | "interactions"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "shipments", label: "Shipment History", icon: <Truck size={13} /> },
  { id: "requests", label: "Booking Request History", icon: <ClipboardList size={13} /> },
  { id: "interactions", label: "Interaction History", icon: <MessageSquare size={13} /> },
]

export function CustomerProfileTabs({
  shipments,
  requests,
  interactions,
}: {
  shipments: any[]
  requests: any[]
  interactions: any[]
}) {
  const [active, setActive] = useState<Tab>("shipments")

  return (
    <div className="bg-background border border-line rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-line overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              active === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Shipment History */}
      {active === "shipments" && (
        <>
          {shipments.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted text-xs">
              Future Freight Operations integration — shipments are owned and tracked by Freight Operations, not CRM.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {shipments.map((s) => (
                <div key={s.shipmentId} className="px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package size={14} className="text-zinc-300 shrink-0" />
                    <div>
                      <p className="text-zinc-800 text-xs font-medium">{s.shipmentId}</p>
                      <p className="text-zinc-400 text-xs">{s.origin} → {s.destination}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-300 text-xs hidden sm:block">{s.bookingDate}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${shipmentStatusStyle[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
              <p className="px-5 py-2 text-[11px] text-amber-600 bg-amber-50/50">
                Demo data — will be replaced by live Freight Operations records.
              </p>
            </div>
          )}
        </>
      )}

      {/* Booking Request History */}
      {active === "requests" && (
        <>
          {requests.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted text-xs">No booking requests yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Request", "Date", "Receiver", "Status"].map((h) => (
                    <th key={h} className="px-5 py-2.5 font-medium text-xs uppercase tracking-wide text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 font-medium text-accent font-mono text-xs">{r.request_id}</td>
                    <td className="px-5 py-3 text-xs whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="px-5 py-3 text-xs truncate max-w-xs">{r.receiver_name}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${requestStatusStyle[r.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Interaction History */}
      {active === "interactions" && (
        <>
          {interactions.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted text-xs">No interactions recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Date", "Channel", "Activity / Notes"].map((h) => (
                    <th key={h} className="px-5 py-2.5 font-medium text-xs uppercase tracking-wide text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interactions.map((i) => (
                  <tr key={i.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 text-xs whitespace-nowrap">{formatDate(i.interaction_date)}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        {CHANNEL_LABELS[i.interaction_type] ?? i.interaction_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted truncate max-w-md">{i.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
