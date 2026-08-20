import { getCustomerById, getShipmentsByCustomerId } from "@/app/(crbc)/services/crm.service"
import { notFound } from "next/navigation"
import { Package, ArrowLeft } from "lucide-react"
import { formatDate } from "@/app/(crbc)/library/utils/formattedate"
import Link from "next/link"

const statusStyle: Record<string, string> = {
  Completed: "bg-emerald-50 text-emerald-600",
  "In Transit": "bg-blue-50 text-blue-600",
  Pending: "bg-amber-50 text-amber-600",
  Cancelled: "bg-red-50 text-red-600",
}

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [customer, shipments] = await Promise.all([getCustomerById(id), getShipmentsByCustomerId(id)])

  if (!customer) notFound()

  const completed = shipments.filter((s) => s.status === "Completed").length
  const inTransit = shipments.filter((s) => s.status === "In Transit").length
  const slaCompliance = shipments.length > 0 ? Math.round((completed / shipments.length) * 100) : 0

  const stats = [
    { label: "Total Shipments", value: shipments.length },
    { label: "Completed", value: completed },
    { label: "In Transit", value: inTransit },
    { label: "SLA Compliance", value: `${slaCompliance}%` },
  ]

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6 text-foreground">
      <Link href="/crbc/customers" className="inline-flex items-center gap-1.5 text-xs  hover:text-zinc-700 transition-colors">
        <ArrowLeft size={13} /> Back to Customers
      </Link>
       <h1 className="text-xl font-semibold text-ink">
            Customer Profile
          </h1>

      <div className="bg-backrgound border border-line rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <span className="font-mono text-xs">Customer ID:</span>
            <span className="font-mono text-xs"> {customer.customer_id}</span>
           <div className="flex items-baseline gap-x-1 mt-0.5">
            <span className="font-mono text-xs">Full Name:</span>
            <span className="text-xs">{customer.full_name}</span>
          </div>
            {/* <p className="text-zinc-400 text-xs mt-1">{customer.address}</p> */}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-line grid grid-cols-2 gap-3 text-xs">
          <div><span className="font-mono text-xs">Email</span><p className=" mt-0.5">{customer.email ?? '-'}</p></div>
          <div><span className="font-mono text-xs">Registered</span><p className=" mt-0.5 font-mono text-[0.70rem]">{formatDate(customer.created_at)}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-backrgound border border-line rounded-xl p-4">
            <p className="text-ink text-xs">{label}</p>
            <p className="text-2xl font-semibold mt-2">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-backrgound border border-line rounded-xl">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="text-sm font-medium">Shipment History</h2>
        </div>
        {shipments.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted text-xs">No shipments found.</p>
        ) : (
          <div className="divide-y divide-zinc-50">
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
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle[s.status]}`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
