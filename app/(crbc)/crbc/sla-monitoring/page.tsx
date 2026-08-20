import { getSLARecords, getSLASummary } from "../../services/sla.service"
import { CheckCircle, AlertTriangle, Clock } from "lucide-react"

const slaStatusStyle: Record<string, string> = {
  "On Time": "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  Delayed: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  Pending: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
}

export default async function SLAPage() {
  const [records, summary] = await Promise.all([getSLARecords(), getSLASummary()])

  const kpis = [
    { label: "SLA Compliance", value: `${summary.compliance}%`, icon: CheckCircle, color: "text-emerald-500" },
    { label: "On Time", value: summary.onTime, icon: CheckCircle, color: "text-blue-500" },
    { label: "Delayed", value: summary.delayed, icon: AlertTriangle, color: "text-red-500" },
    { label: "Pending", value: summary.total - summary.onTime - summary.delayed, icon: Clock, color: "text-amber-500" },
  ]

  return (
    <div className="w-full py-4 space-y-6">
      <div>
        <h1 className="text-foreground text-xl font-semibold">SLA Monitoring</h1>
        <p className="text-muted text-sm mt-0.5">Monitor delivery performance against SLA policies</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-paper border border-line rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted text-xs">{label}</span>
              <Icon size={14} className={color} />
            </div>
            <p className="text-foreground text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-paper border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="text-ink text-sm font-medium">SLA Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {["Shipment No.", "Region", "Expected Delivery", "Actual Delivery", "Variance", "SLA Status"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium text-xs text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.shipmentId} className="border-b border-line last:border-0 hover:bg-line/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-accent text-xs">{r.shipmentId}</td>
                  <td className="px-4 py-3 text-muted text-xs">{r.region}</td>
                  <td className="px-4 py-3 text-muted text-xs">{r.expectedDelivery}</td>
                  <td className="px-4 py-3 text-muted text-xs">{r.actualDelivery ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.daysVariance === null ? (
                      <span className="text-muted">—</span>
                    ) : r.daysVariance <= 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">{Math.abs(r.daysVariance)}d early</span>
                    ) : (
                      <span className="text-red-500 dark:text-red-400">+{r.daysVariance}d late</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${slaStatusStyle[r.slaStatus]}`}>{r.slaStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
