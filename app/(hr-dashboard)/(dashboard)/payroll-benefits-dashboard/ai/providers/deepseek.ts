import { AI_CONFIG } from "../config";
import type { LLMRequest, LLMResponse } from "../shared/types";

function validateKey(): string {
  const k = process.env.DEEP_SEEK_API_KEY_HR;
  if (!k || !k.startsWith("sk-")) {
    throw new Error(
      "DEEP_SEEK_API_KEY_HR missing or malformed (must start with sk-)."
    );
  }
  return k;
}

export async function deepseekChat(req: LLMRequest): Promise<LLMResponse> {
  const cfg = AI_CONFIG.deepseek;
  const apiKey = validateKey();

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
    if (res.status === 401) {
      throw new Error("DeepSeek rejected the key (401).");
    }
    if (res.status === 402) {
      throw new Error("DeepSeek: insufficient balance.");
    }
    throw new Error(`DeepSeek error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    provider: "deepseek",
    model: cfg.model,
  };
}
