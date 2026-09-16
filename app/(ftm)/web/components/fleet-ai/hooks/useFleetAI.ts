import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getCurrentRole, type AppRole } from "../../../lib/roleAccess";
import { quickActionsForRole } from "../utils/chatbotCommands";
import { useChat } from "./useChat";

const ELIGIBLE_ROLES: AppRole[] = ["admin", "fleet_manager", "dispatcher", "driver"];

function greetingFor(role: AppRole | null): string {
  switch (role) {
    case "driver":
      return "Good day. I can help you check your current trip, vehicle assignment, and report issues.";
    case "dispatcher":
      return "Good day. I can help you monitor dispatch, active trips, and route plans.";
    default:
      return "Good afternoon. I can help you monitor your fleet and transportation operations.";
  }
}

export function useFleetAI() {
  const pathname = usePathname() || "fleet-dashboard";
  const [role, setRole] = useState<AppRole | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const chat = useChat(pathname);

  useEffect(() => {
    setRole(getCurrentRole());
    // Role is written to localStorage by lib/auth.ts on sign-in; poll lightly
    // so the widget updates if the user signs in/out in another tab.
    const interval = window.setInterval(() => setRole(getCurrentRole()), 4000);
    return () => window.clearInterval(interval);
  }, []);

  const isEligible = role != null && ELIGIBLE_ROLES.includes(role);

  const open = useCallback(() => setIsOpen(true), []);

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const quickActions = useMemo(() => quickActionsForRole(role), [role]);

  return {
    isEligible,
    role,
    isOpen,
    open,
    close,
    toggle,
    quickActions,
    greeting: greetingFor(role),
    ...chat,
  };
}
