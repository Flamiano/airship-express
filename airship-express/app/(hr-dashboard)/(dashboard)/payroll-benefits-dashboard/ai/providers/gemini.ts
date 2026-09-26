import { AI_CONFIG } from "../config";
import type { LLMRequest, LLMResponse } from "../shared/types";

export async function geminiChat(req: LLMRequest): Promise<LLMResponse> {
  const cfg = AI_CONFIG.gemini;

  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemInstruction = req.messages.find((m) => m.role === "system");

  const res = await fetch(
    `${cfg.baseUrl}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction.content }] }
          : undefined,
        generationConfig: {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxTokens ?? 1024,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return { content: text, provider: "gemini", model: cfg.model };
}
