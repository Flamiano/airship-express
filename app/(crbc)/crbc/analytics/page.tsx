import { getAnalyticsSummary } from "../../services/analytics.service"
import { TrendingUp, Users, Package, CheckCircle } from "lucide-react"

function BarChart({ data, valueKey, labelKey }: { data: Record<string, unknown>[], valueKey: string, labelKey: string }) {
  const max = Math.max(...data.map((d) => d[valueKey] as number), 1)
  return (
    <div className="flex items-end gap-2 h-28 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-foreground text-xs">{d[valueKey] as number}</span>
          <div
            className="w-full bg-indigo-100 rounded-t-sm"
            style={{ height: `${((d[valueKey] as number) / max) * 80}px` }}
          />
          <span className="text-foreground text-xs">{d[labelKey] as string}</span>
        </div>
      ))}
    </div>
  )
}

function PillRow({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <div className="space-y-2 mt-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-foreground text-xs w-28 shrink-0">{item.label}</span>
          <div className="flex-1 bg-zinc-100 rounded-full h-2">
            <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }} />
          </div>
          <span className="text-foreground text-xs w-6 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsSummary()

  const kpis = [
    { label: "Total Customers", value: data.totalCustomers, icon: Users, color: "text-indigo-500" },
    { label: "Active Customers", value: data.activeCustomers, icon: TrendingUp, color: "text-emerald-500" },
    { label: "Total Shipments", value: data.totalShipments, icon: Package, color: "text-blue-500" },
    { label: "SLA Compliance", value: `${data.slaCompliance}%`, icon: CheckCircle, color: "text-purple-500" },
  ]

  return (
    <div className="w-full py-4 space-y-6">
      <div>
        <h1 className="text-foreground text-xl font-semibold">BI & Freight Analytics</h1>
        <p className="text-muted text-sm mt-0.5">Business intelligence and freight performance reports</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-background border border-line rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-foreground text-xs font-bold">{label}</span>
              <Icon size={14} className={color} />
            </div>
            <p className="text-foreground text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Growth */}
        <div className="bg-backrgound border border-line rounded-xl p-5">
          <h2 className="text-foreground text-sm font-medium mb-1">Customer Growth</h2>
          <p className="text-foreground text-xs mb-3">Monthly customer count</p>
          <BarChart data={data.customerGrowth} valueKey="customers" labelKey="month" />
        </div>

        {/* Monthly Shipments */}
        <div className="bg-backrgound border border-line rounded-xl p-5">
          <h2 className="text-foreground text-sm font-medium mb-1">Monthly Shipments</h2>
          <p className="text-foreground text-xs mb-3">Shipments booked per month</p>
          <BarChart data={data.monthlyShipments} valueKey="count" labelKey="month" />
        </div>

        {/* Shipments by Destination */}
        <div className="bg-backrgound border border-line rounded-xl p-5">
          <h2 className="text-foreground text-sm font-medium mb-1">Shipments by Destination</h2>
          <PillRow items={data.shipmentsByDestination.map((d) => ({ label: d.destination, value: d.count, color: "bg-indigo-400" }))} />
        </div>

        {/* Shipments by Status */}
        <div className="bg-backrgound border border-line rounded-xl p-5">
          <h2 className="text-foreground text-sm font-medium mb-1">Shipments by Status</h2>
          <PillRow items={data.shipmentsByStatus.map((d) => ({
            label: d.status,
            value: d.count,
            color: d.status === "Completed" ? "bg-emerald-400" : d.status === "In Transit" ? "bg-blue-400" : "bg-amber-400",
          }))} />
        </div>

        {/* Customer Breakdown */}
        <div className="bg-backrgound border border-line rounded-xl p-5">
          <h2 className="text-foreground text-sm font-medium mb-1">Active vs Inactive Customers</h2>
          <PillRow items={[
            { label: "Active", value: data.activeCustomers, color: "bg-emerald-400" },
            { label: "Inactive", value: data.inactiveCustomers, color: "bg-zinc-300" },
          ]} />
        </div>

        {/* SLA Performance */}
        <div className="bg-backrgound border border-line rounded-xl p-5">
          <h2 className="text-foreground text-sm font-medium mb-1">SLA Performance</h2>
          <div className="mt-4 flex items-center justify-center">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f4f4f5" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#818cf8" strokeWidth="3"
                  strokeDasharray={`${data.slaCompliance} ${100 - data.slaCompliance}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-foreground text-xl font-bold">{data.slaCompliance}%</span>
                <span className="text-foreground text-xs">Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
