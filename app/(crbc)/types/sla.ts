export type SLAStatus = "On Time" | "Delayed" | "Pending"

export interface SLAPolicy {
  region: string
  maxDays: number
}

export interface SLARecord {
  shipmentId: string
  customerId: string
  region: string
  expectedDelivery: string
  actualDelivery: string | null
  slaStatus: SLAStatus
  daysVariance: number | null
}
