export type RobotState = "idle" | "thinking" | "listening" | "speaking" | "success" | "error" | "loading";

export type ChatRole = "user" | "assistant";

export type StructuredCardType =
  | "fleet_summary"
  | "vehicle_list"
  | "vehicle"
  | "trip_list"
  | "trip"
  | "driver_list"
  | "driver"
  | "dispatch_list"
  | "route_list"
  | "fuel_summary"
  | "maintenance_list"
  | "incident_created"
  | "raw";

export interface StructuredCard {
  type: StructuredCardType;
  tool: string;
  data: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  structuredData?: StructuredCard[];
  isError?: boolean;
}

export interface ChatApiResponse {
  conversationId?: string;
  reply: string;
  structuredData?: Array<{ tool: string; input?: Record<string, any>; data: Record<string, any> }>;
  toolsUsed?: string[];
  error?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  roles: Array<"admin" | "fleet_manager" | "dispatcher" | "driver">;
}
