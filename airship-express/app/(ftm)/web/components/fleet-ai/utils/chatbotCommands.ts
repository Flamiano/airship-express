import { QUICK_ACTIONS } from "../config/chatbotConfig";
import type { AppRole } from "../../../lib/roleAccess";
import type { QuickAction } from "../types/chatbot";

export function quickActionsForRole(role: AppRole | null): QuickAction[] {
  if (!role) return [];
  return QUICK_ACTIONS.filter((action) => action.roles.includes(role as any));
}

/** Resolves "them"/"it"-style follow-ups is handled by the AI's own memory of
 * the conversation - this helper only decides what the initial quick-action
 * prompt text should be, so clicking a button is never decorative. */
export function promptForQuickAction(actionId: string): string | null {
  const action = QUICK_ACTIONS.find((a) => a.id === actionId);
  return action?.prompt ?? null;
}
