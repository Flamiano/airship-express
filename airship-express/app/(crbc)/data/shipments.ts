import { Shipment } from "../types/shipment"

export const shipments: Shipment[] = [
  { shipmentId: "SHP-10981", customerId: "CUS-4421", origin: "Manila", destination: "Quezon City", status: "In Transit", bookingDate: "2026-07-20", actualDelivery: null, region: "Metro Manila" },
  { shipmentId: "SHP-10877", customerId: "CUS-4421", origin: "Manila", destination: "Makati", status: "Completed", bookingDate: "2026-06-11", actualDelivery: "2026-06-12", region: "Metro Manila" },
  { shipmentId: "SHP-10756", customerId: "CUS-4421", origin: "Manila", destination: "Cebu City", status: "Completed", bookingDate: "2026-05-02", actualDelivery: "2026-05-04", region: "Visayas" },
  { shipmentId: "SHP-10702", customerId: "CUS-4421", origin: "Manila", destination: "Baguio City", status: "Pending", bookingDate: "2026-06-18", actualDelivery: null, region: "Luzon" },
  { shipmentId: "SHP-10650", customerId: "CUS-4418", origin: "Cebu City", destination: "Manila", status: "Completed", bookingDate: "2026-07-01", actualDelivery: "2026-07-02", region: "Visayas" },
  { shipmentId: "SHP-10590", customerId: "CUS-4371", origin: "Manila", destination: "Davao City", status: "In Transit", bookingDate: "2026-07-15", actualDelivery: null, region: "Mindanao" },
  { shipmentId: "SHP-10540", customerId: "CUS-4401", origin: "Manila", destination: "Iloilo City", status: "Completed", bookingDate: "2026-06-20", actualDelivery: "2026-06-24", region: "Visayas" },
  { shipmentId: "SHP-10480", customerId: "CUS-4398", origin: "Manila", destination: "Cagayan de Oro", status: "Completed", bookingDate: "2026-05-10", actualDelivery: "2026-05-17", region: "Mindanao" },
  { shipmentId: "SHP-10420", customerId: "CUS-4352", origin: "Cebu City", destination: "Tacloban", status: "Completed", bookingDate: "2026-04-01", actualDelivery: "2026-04-04", region: "Visayas" },
  { shipmentId: "SHP-10380", customerId: "CUS-4418", origin: "Manila", destination: "Davao City", status: "Completed", bookingDate: "2026-03-15", actualDelivery: "2026-03-21", region: "Mindanao" },
]
