import { supabase } from "../../../lib/supabaseClient";
import { FLEET_AI_CHAT_ENDPOINT, FLEET_AI_CONVERSATION_ENDPOINT } from "../config/chatbotConfig";
import type { ChatApiResponse } from "../types/chatbot";

export class FleetAIError extends Error {
  code: string;
  constructor(message: string, code = "UNKNOWN") {
    super(message);
    this.code = code;
  }
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new FleetAIError("You need to be signed in to use Fleet AI.", "NOT_AUTHENTICATED");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
  } catch (err) {
    throw new FleetAIError("Could not reach the Fleet AI service. Check your connection and try again.", "NETWORK_ERROR");
  }

  if (response.status === 401) {
    throw new FleetAIError("Your session has expired. Please sign in again.", "UNAUTHENTICATED");
  }
  if (response.status === 403) {
    const body = await response.json().catch(() => null);
    throw new FleetAIError(body?.error || "Fleet AI is not available for this account.", "FORBIDDEN");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new FleetAIError(body?.error || `Request failed (${response.status}).`, "REQUEST_FAILED");
  }

  return response.json();
}

export async function sendChatMessage(params: {
  message: string;
  conversationId?: string | null;
  page?: string;
}): Promise<ChatApiResponse> {
  return authedFetch(FLEET_AI_CHAT_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({
      message: params.message,
      conversationId: params.conversationId || undefined,
      context: { page: params.page || "fleet-dashboard" },
    }),
  });
}

export async function fetchConversationHistory(conversationId: string) {
  return authedFetch(FLEET_AI_CONVERSATION_ENDPOINT(conversationId), { method: "GET" });
}
