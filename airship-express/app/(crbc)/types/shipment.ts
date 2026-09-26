export type ShipmentStatus = "Completed" | "In Transit" | "Pending" | "Cancelled"

export interface Shipment {
  shipmentId: string
  customerId: string
  origin: string
  destination: string
  status: ShipmentStatus
  bookingDate: string
  actualDelivery: string | null
  region: string
}
