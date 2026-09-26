import { AI_CONFIG } from "../config";
import type { LLMRequest, LLMResponse } from "../shared/types";

function validateKey(): string {
  const k = process.env.GEMINI_API_KEY_HR;
  if (!k) {
    throw new Error("GEMINI_API_KEY_HR is missing from the environment.");
  }
  return k;
}

export async function geminiChat(req: LLMRequest): Promise<LLMResponse> {
  const cfg = AI_CONFIG.gemini;
  const apiKey = validateKey();
  
  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemInstruction = req.messages.find((m) => m.role === "system");

  const res = await fetch(
    `${cfg.baseUrl}/models/${cfg.model}:generateContent?key=${apiKey}`,
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
    if (res.status === 400 || res.status === 403) {
      throw new Error(
        `Gemini rejected key or model "${cfg.model}". Check aistudio.google.com/apikey.`
      );
    }
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { content: text, provider: "gemini", model: cfg.model };
}

export async function geminiVision(opts: {
  prompt: string;
  imageBase64: string;
  mimeType: string;
  maxTokens?: number;
}): Promise<{ content: string; provider: "gemini"; model: string }> {
  const cfg = AI_CONFIG.gemini;
  const apiKey = validateKey();

  const res = await fetch(
    `${cfg.baseUrl}/models/${cfg.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: opts.prompt },
              {
                inline_data: {
                  mime_type: opts.mimeType,
                  data: opts.imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: opts.maxTokens ?? 800,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini vision error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { content: text, provider: "gemini", model: cfg.model };
}
