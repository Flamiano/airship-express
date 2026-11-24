import type { ChatApiResponse, StructuredCard, StructuredCardType } from "../types/chatbot";

const TOOL_TO_CARD: Record<string, StructuredCardType> = {
  get_fleet_summary: "fleet_summary",
  get_available_vehicles: "vehicle_list",
  get_vehicle_status: "vehicle",
  get_active_trips: "trip_list",
  get_trip_status: "trip",
  get_available_drivers: "driver_list",
  get_driver_status: "driver",
  get_active_dispatches: "dispatch_list",
  get_route_information: "route_list",
  get_fuel_summary: "fuel_summary",
  get_vehicle_maintenance: "maintenance_list",
  create_incident_report: "incident_created",
};

function cardTypeForTool(tool: string): StructuredCardType {
  return TOOL_TO_CARD[tool] || "raw";
}

export function toStructuredCards(response: ChatApiResponse): StructuredCard[] {
  if (!response.structuredData || response.structuredData.length === 0) return [];
  return response.structuredData
    .filter((entry) => entry?.data && !entry.data.error)
    .map((entry) => ({
      type: cardTypeForTool(entry.tool),
      tool: entry.tool,
      data: entry.data,
    }));
}
