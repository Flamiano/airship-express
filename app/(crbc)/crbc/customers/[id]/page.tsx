import {
  getCustomerById,
  getInteractionsByCustomerId,
  getBookingRequestsByCustomerId,
  getShipmentsByCustomerId,
} from "@/app/(crbc)/services/crm.service"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Package,
  MessageSquare,
  ClipboardList,
  Truck,
} from "lucide-react"
import { formatDate } from "@/app/(crbc)/library/utils/formattedate"
import Link from "next/link"
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

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [customer, interactions, requests, shipments] = await Promise.all([
    getCustomerById(id),
    getInteractionsByCustomerId(id),
    getBookingRequestsByCustomerId(id),
    getShipmentsByCustomerId(id),
  ])

  if (!customer) notFound()

  const infoRows: { label: string; value: string }[] = [
    { label: "Customer ID", value: customer.customer_id },
    { label: "Full Name", value: customer.full_name },
    { label: "Customer Type", value: customer.role === "customer" ? "Individual" : customer.role },
    { label: "Email", value: customer.email ?? "-" },
    { label: "Phone", value: customer.phone ?? "-" },
    { label: "Address", value: customer.address ?? "-" },
    { label: "Registered", value: formatDate(customer.created_at) },
  ]

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6 text-foreground">
      <Link
        href="/crbc/customers"
        className="inline-flex items-center gap-1.5 text-xs hover:text-zinc-700 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Customers
      </Link>

      {/* Customer Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{customer.full_name}</h1>
        <span className="font-mono text-xs text-accent">
          {customer.customer_id}
        </span>
      </div>

      {/* Customer Information — permanent identity */}
      <section className="bg-background border border-line rounded-xl p-6">
        <h2 className="text-sm font-medium mb-4">Customer Information</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
          {infoRows.map(({ label, value }) => (
            <div key={label}>
              <dt className="font-mono text-muted">{label}</dt>
              <dd className="mt-0.5 text-sm">{value}</dd>
            </div>
          ))}
          <div>
            <dt className="font-mono text-muted">Status</dt>
            <dd className="mt-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-medium">
                Active
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Customer Interaction History — HOW/WHEN they interacted with us */}
      <section className="bg-background border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <MessageSquare size={14} className="text-muted" />
          <h2 className="text-sm font-medium">Interaction History</h2>
        </div>
        {interactions.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted text-xs">
            No interactions recorded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {["Date", "Channel", "Activity / Notes"].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-2.5 font-medium text-xs uppercase tracking-wide text-muted"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {interactions.map((interaction) => (
                <tr
                  key={interaction.id}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className="px-5 py-3 text-xs whitespace-nowrap">
                    {formatDate(interaction.interaction_date)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                      {CHANNEL_LABELS[interaction.interaction_type] ??
                        interaction.interaction_type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted truncate max-w-md">
                    {interaction.notes ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Booking Request History — CRM-owned requests (REQ-xxxx) */}
      <section className="bg-background border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <ClipboardList size={14} className="text-muted" />
          <h2 className="text-sm font-medium">Booking Request History</h2>
        </div>
        {requests.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted text-xs">
            No booking requests yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {["Request", "Date", "Receiver", "Status"].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-2.5 font-medium text-xs uppercase tracking-wide text-muted"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className="px-5 py-3 font-medium text-accent font-mono text-xs">
                    {request.request_id}
                  </td>
                  <td className="px-5 py-3 text-xs whitespace-nowrap">
                    {formatDate(request.created_at)}
                  </td>
                  <td className="px-5 py-3 text-xs truncate max-w-xs">
                    {request.receiver_name}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        requestStatusStyle[request.status] ??
                        "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Shipment History — read-only; operational data belongs to
          Freight Operations. Placeholder until their API is available. */}
      <section className="bg-background border border-dashed border-line rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <Truck size={14} className="text-muted" />
          <h2 className="text-sm font-medium">Shipment History</h2>
        </div>

        {/* Demo data until Freight Operations integration lands — not CRM-owned. */}
        {shipments.length > 0 && (
          <div className="divide-y divide-line">
            {shipments.map((s) => (
              <div
                key={s.shipmentId}
                className="px-5 py-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Package size={14} className="text-zinc-300 shrink-0" />
                  <div>
                    <p className="text-zinc-800 text-xs font-medium">
                      {s.shipmentId}
                    </p>
                    <p className="text-zinc-400 text-xs">
                      {s.origin} → {s.destination}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-zinc-300 text-xs hidden sm:block">
                    {s.bookingDate}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${shipmentStatusStyle[s.status]}`}
                  >
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

        <p className="px-5 py-8 text-center text-muted text-xs">
          Future Freight Operations integration — shipments are owned and tracked
          by Freight Operations, not CRM.
        </p>
      </section>
    </div>
  )
}
