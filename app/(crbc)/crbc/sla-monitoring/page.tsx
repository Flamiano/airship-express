import { getSlaOverviewData } from "../../services/sla.service"
import { CheckCircle, AlertTriangle, Clock, HelpCircle, Truck } from "lucide-react"
import SlaTableClient from "../../components/sla/SlaTableClient"

const DEFAULT_PAGE_SIZE = 10

export default async function SLAPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; search?: string; status?: string }>
}) {
  const sp = await searchParams
  const { records, summary } = await getSlaOverviewData()

  // Parse params
  const page       = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const pageSize   = [10, 20, 50].includes(parseInt(sp.pageSize ?? "", 10))
    ? parseInt(sp.pageSize!, 10)
    : DEFAULT_PAGE_SIZE
  const search       = sp.search?.trim() ?? ""
  const statusFilter = sp.status ?? "all"

  // Filter
  const filtered = records.filter((r) => {
    if (statusFilter !== "all" && r.slaStatus !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.shipmentId.toLowerCase().includes(q) ||
        (r.region ?? "not evaluable").toLowerCase().includes(q)
      )
    }
    return true
  })

  // Paginate
  const totalCount = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const kpis = [
    { label: "SLA Compliance",    value: `${summary.compliance}%`, icon: CheckCircle, color: "text-emerald-500" },
    { label: "On Time",           value: summary.onTime,           icon: CheckCircle, color: "text-blue-500" },
    { label: "Late Delivery",     value: summary.late,             icon: AlertTriangle, color: "text-red-500" },
    { label: "Overdue In-Transit",value: summary.overdue,          icon: Truck,       color: "text-orange-500" },
    { label: "Pending",           value: summary.pending,          icon: Clock,       color: "text-amber-500" },
    { label: "Not Evaluable",     value: summary.notEvaluable,     icon: HelpCircle,  color: "text-zinc-500" },
  ]

  return (
    <div className="w-full py-4 space-y-6">
      <div>
        <h1 className="text-foreground text-xl font-semibold">SLA Monitoring</h1>
        <p className="text-muted text-sm mt-0.5">
          Monitor delivery performance against SLA policies · compliance counts delivered
          shipments only, as of {summary.evaluationDate}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-background border border-line rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted text-xs">{label}</span>
              <Icon size={14} className={color} />
            </div>
            <p className="text-foreground text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="px-1 pb-3">
          <h2 className="text-foreground text-sm font-medium">SLA Records</h2>
        </div>
        <SlaTableClient
          rows={pageRows}
          page={safePage}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          search={search}
          statusFilter={statusFilter}
        />
      </div>
    </div>
  )
}
