import type { QuickAction } from "../types/chatbot";

export const FLEET_AI_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export const FLEET_AI_CHAT_ENDPOINT = `${FLEET_AI_API_BASE}/api/fleet-ai/chat`;
export const FLEET_AI_CONVERSATION_ENDPOINT = (id: string) =>
  `${FLEET_AI_API_BASE}/api/fleet-ai/conversations/${encodeURIComponent(id)}`;

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "fleet-summary",
    label: "Fleet Summary",
    prompt: "Give me a fleet summary.",
    icon: "dashboard",
    roles: ["admin", "fleet_manager", "dispatcher"],
  },
  {
    id: "active-trips",
    label: "Active Trips",
    prompt: "Show me active trips.",
    icon: "route",
    roles: ["admin", "fleet_manager", "dispatcher", "driver"],
  },
  {
    id: "available-vehicles",
    label: "Available Vehicles",
    prompt: "Which vehicles are available right now?",
    icon: "local_shipping",
    roles: ["admin", "fleet_manager", "dispatcher"],
  },
  {
    id: "driver-status",
    label: "Driver Status",
    prompt: "What's the status of available drivers?",
    icon: "badge",
    roles: ["admin", "fleet_manager", "dispatcher"],
  },
  {
    id: "my-status",
    label: "My Status",
    prompt: "What's my current trip and vehicle assignment?",
    icon: "person_pin",
    roles: ["driver"],
  },
  {
    id: "active-dispatch",
    label: "Active Dispatch",
    prompt: "Show me the active dispatches.",
    icon: "dispatch",
    roles: ["admin", "fleet_manager", "dispatcher"],
  },
  {
    id: "route-status",
    label: "Route Status",
    prompt: "Show me the current route plans.",
    icon: "map",
    roles: ["admin", "fleet_manager", "dispatcher"],
  },
  {
    id: "fuel-summary",
    label: "Fuel Summary",
    prompt: "Give me a fuel consumption summary for the last 30 days.",
    icon: "local_gas_station",
    roles: ["admin", "fleet_manager"],
  },
  {
    id: "report-issue",
    label: "Report Issue",
    prompt: "I need to report an operational issue.",
    icon: "report",
    roles: ["admin", "fleet_manager", "dispatcher", "driver"],
  },
];

export const ROBOT_COLORS = {
  bodyPrimary: "#e8ebf0",
  bodySecondary: "#c7ccd6",
  jointDark: "#2b2f38",
  jointDarker: "#1b1e24",
  accent: "#22d3ee",
  eyeIdle: "#38bdf8",
  eyeThinking: "#a855f7",
  eyeListening: "#22d3ee",
  eyeSpeaking: "#38bdf8",
  eyeSuccess: "#34d399",
  eyeError: "#f87171",
  ledOnline: "#34d399",
  ledError: "#f87171",
};
