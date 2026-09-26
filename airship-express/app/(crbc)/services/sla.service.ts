import { shipments } from "../data/shipments"
import { slaPolicies } from "../data/sla"
import { SLARecord, SLAStatus } from "../types/sla"

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function addDays(date: string, days: number): string {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result.toISOString().split("T")[0]
}

export async function getSLARecords(): Promise<SLARecord[]> {
  return shipments
    .filter((s) => s.status === "Completed" || s.status === "In Transit")
    .map((s) => {
      const policy = slaPolicies.find((p) => p.region === s.region)
      const maxDays = policy?.maxDays ?? 14
      const expectedDelivery = addDays(s.bookingDate, maxDays)
      let slaStatus: SLAStatus = "Pending"
      let daysVariance: number | null = null

      if (s.actualDelivery) {
        const actual = daysBetween(s.bookingDate, s.actualDelivery)
        daysVariance = actual - maxDays
        slaStatus = actual <= maxDays ? "On Time" : "Delayed"
      }

      return {
        shipmentId: s.shipmentId,
        customerId: s.customerId,
        region: s.region,
        expectedDelivery,
        actualDelivery: s.actualDelivery,
        slaStatus,
        daysVariance,
      }
    })
}

export async function getSLASummary() {
  const records = await getSLARecords()
  const completed = records.filter((r) => r.slaStatus !== "Pending")
  const onTime = completed.filter((r) => r.slaStatus === "On Time").length
  const delayed = completed.filter((r) => r.slaStatus === "Delayed").length
  const compliance = completed.length > 0 ? Math.round((onTime / completed.length) * 100) : 0
  return { total: records.length, onTime, delayed, compliance }
}
