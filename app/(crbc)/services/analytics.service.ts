import { customers } from "../data/customers"
import { shipments } from "../data/shipments"
import { customerGrowth, monthlyShipments, shipmentsByDestination, shipmentsByStatus } from "../data/analytics"

export async function getAnalyticsSummary() {
  const active = customers.filter((c) => c.status === "Active").length
  const inactive = customers.filter((c) => c.status === "Inactive").length
  const completed = shipments.filter((s) => s.status === "Completed").length
  const slaCompliant = shipments.filter((s) => s.actualDelivery && s.actualDelivery <= s.actualDelivery).length
  const slaCompliance = completed > 0 ? Math.round((slaCompliant / completed) * 100) : 0

  return {
    totalCustomers: customers.length,
    activeCustomers: active,
    inactiveCustomers: inactive,
    totalShipments: shipments.length,
    completedShipments: completed,
    slaCompliance,
    customerGrowth,
    monthlyShipments,
    shipmentsByDestination,
    shipmentsByStatus,
  }
}
