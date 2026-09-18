"use client";

import type { LLMRequest, LLMResponse, StreamChunk } from "../shared/types";

const CHAT_ENDPOINT = "/payroll-benefits-dashboard/ai/api/chat";

export async function chat(req: LLMRequest): Promise<LLMResponse> {
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Chat request failed: ${res.status}`);
  }

  return res.json();
}

export async function* streamChat(
  req: LLMRequest
): AsyncGenerator<StreamChunk> {
  const res = await fetch(`${CHAT_ENDPOINT}?stream=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Chat stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const payload = trimmed.replace(/^data:\s*/, "");
      if (payload === "[DONE]") {
        yield { delta: "", done: true };
        return;
      }

      try {
        const parsed = JSON.parse(payload);
        if (parsed.attachment)
          yield { delta: "", done: false, attachment: parsed.attachment };
        if (parsed.delta) yield { delta: parsed.delta, done: false };
        if (parsed.error) throw new Error(parsed.error);
      } catch (e) {
        // skip malformed
      }
    }
  }

  yield { delta: "", done: true };
}

export const Providers = { chat, streamChat };
