import { AI_CONFIG } from "../config";
import type { LLMRequest, LLMResponse } from "../shared/types";

export async function deepseekChat(req: LLMRequest): Promise<LLMResponse> {
  const cfg = AI_CONFIG.deepseek;

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 1024,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    provider: "deepseek",
    model: cfg.model,
  };
}
