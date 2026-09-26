import {
  getCustomerById,
  getInteractionsByCustomerId,
  getBookingRequestsByCustomerId,
  getShipmentsByCustomerId,
} from "@/app/(crbc)/services/crm.service"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { formatDate } from "@/app/(crbc)/library/utils/formattedate"
import Link from "next/link"
import { CustomerProfileTabs } from "@/app/(crbc)/components/customers/CustomerProfileTabs"

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

      <CustomerProfileTabs
        shipments={shipments}
        requests={requests}
        interactions={interactions}
      />
    </div>
  )
}
